import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type React from 'react';
import { getInventoryMovements, importInventoryCsv, updateInventory } from '../services/inventory';
import { createProduct, deleteProduct, updateProduct } from '../services/products';
import type { StockItem, StockMovement, StockMovementType } from '../types/orders';

interface StockManagementSectionProps {
  stock: StockItem[];
  setStock: Dispatch<SetStateAction<StockItem[]>>;
  movements: StockMovement[];
  onRegisterMovements: (movements: Array<Omit<StockMovement, 'id' | 'createdAt'>>) => void;
}

type EditableRowState = Record<string, { total: string; reserved: string }>;
type ProductEditState = {
  originalCodigo: string;
  codigo: string;
  produto: string;
  total: string;
  reservado: string;
  fotoUrl: string;
};

type StockIdentity = StockItem & {
  productId?: string;
  id?: string;
};

const movementTypeLabels: Record<StockMovementType, string> = {
  ENTRY: 'Entrada',
  RESERVATION: 'Reserva',
  RELEASE: 'Liberacao',
  EXIT: 'Saida',
};

const movementTypeClass: Record<StockMovementType, string> = {
  ENTRY: 'bg-emerald-500/15 text-emerald-400 light:bg-emerald-100 light:text-emerald-700',
  RESERVATION: 'bg-sky-500/15 text-sky-400 light:bg-sky-100 light:text-sky-700',
  RELEASE: 'bg-amber-500/15 text-amber-400 light:bg-amber-100 light:text-amber-700',
  EXIT: 'bg-rose-500/15 text-rose-400 light:bg-rose-100 light:text-rose-700',
};

function toLocalDateTime(isoDate: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(isoDate));
}

function toInputDate(isoDate: string) {
  const date = new Date(isoDate);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeMovementType(value: unknown): StockMovementType {
  if (value === 'ENTRY' || value === 'RESERVATION' || value === 'RELEASE' || value === 'EXIT') {
    return value;
  }

  return 'ENTRY';
}

async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(new Error('Falha ao carregar imagem.'));
    reader.readAsDataURL(file);
  });
}

export function StockManagementSection({ stock, setStock, movements, onRegisterMovements }: StockManagementSectionProps) {
  const [editableRows, setEditableRows] = useState<EditableRowState>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [importFeedback, setImportFeedback] = useState('');
  const [importError, setImportError] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<'ALL' | StockMovementType>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);
  const [showMovementHistory, setShowMovementHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ codigo: '', produto: '', total: '0', reservado: '0', fotoUrl: '' });
  const [editingProduct, setEditingProduct] = useState<ProductEditState | null>(null);
  const [editModalError, setEditModalError] = useState('');
  const [isSyncingStock, setIsSyncingStock] = useState('');
  const [stockActionError, setStockActionError] = useState('');
  const [usingLocalStockFallback, setUsingLocalStockFallback] = useState(false);
  const [apiMovements, setApiMovements] = useState<StockMovement[] | null>(null);

  const getStockProductId = (item: StockItem) => {
    const stockIdentity = item as StockIdentity;
    return stockIdentity.productId ?? stockIdentity.id ?? item.produto;
  };

  const buildInventoryUpdatePayload = (
    item: StockItem,
    changes?: Partial<{ total: number }>,
  ) => {
    const total = changes?.total ?? item.total;
    const quantityToAdd = total - item.total;

    if (quantityToAdd <= 0) {
      return null;
    }

    return {
      quantity: quantityToAdd,
      reason: 'Entrada manual no painel web',
    };
  };

  const updateStockItemLocally = (
    productId: string,
    changes: Partial<Pick<StockItem, 'codigo' | 'produto' | 'total' | 'reservado' | 'fotoUrl'>>,
  ) => {
    setStock(currentStock =>
      currentStock.map(item =>
        getStockProductId(item) === productId
          ? { ...item, ...changes }
          : item,
      ),
    );
  };

  const getApiErrorMessage = (error: unknown) => {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return 'Falha na comunicacao com a API.';
  };

  const runWithFallback = async (syncKey: string, onApiAction: () => Promise<void>, onLocalFallback: () => void) => {
    setIsSyncingStock(syncKey);
    setStockActionError('');
    setImportError('');

    try {
      await onApiAction();
      setUsingLocalStockFallback(false);
    } catch {
      onLocalFallback();
      setUsingLocalStockFallback(true);
      setStockActionError('API indisponivel. A alteracao foi simulada localmente.');
    } finally {
      setIsSyncingStock('');
    }
  };

  useEffect(() => {
    const nextEditableRows = stock.reduce<EditableRowState>((acc, item) => {
      acc[item.produto] = {
        total: String(item.total),
        reserved: String(item.reservado),
      };
      return acc;
    }, {});

    setEditableRows(nextEditableRows);
  }, [stock]);

  useEffect(() => {
    let active = true;

    const loadMovements = async () => {
      try {
        const response = await getInventoryMovements();
        if (!active) {
          return;
        }

        const mapped = response.map((movement, index) => ({
          id: typeof movement.id === 'string' ? movement.id : `${Date.now()}-${index}`,
          product: movement.productName ?? movement.productId ?? 'Produto',
          type: normalizeMovementType(movement.type),
          quantity: typeof movement.quantity === 'number' ? movement.quantity : 0,
          source: movement.source ?? 'Movimentacao API',
          createdAt: movement.createdAt ?? new Date().toISOString(),
        }));

        setApiMovements(mapped);
      } catch {
        if (!active) {
          return;
        }

        setApiMovements(null);
      }
    };

    void loadMovements();

    return () => {
      active = false;
    };
  }, []);

  const applyStockUpdateLocally = (
    productId: string,
    productName: string,
    oldTotal: number,
    oldReserved: number,
    newTotal: number,
    newReserved: number,
  ) => {
    const movementsToRegister: Array<Omit<StockMovement, 'id' | 'createdAt'>> = [];
    const totalDiff = newTotal - oldTotal;
    const reservedDiff = newReserved - oldReserved;

    if (totalDiff > 0) {
      movementsToRegister.push({
        product: productName,
        type: 'ENTRY',
        quantity: totalDiff,
        source: 'Ajuste manual de estoque fisico',
      });
    } else if (totalDiff < 0) {
      movementsToRegister.push({
        product: productName,
        type: 'EXIT',
        quantity: Math.abs(totalDiff),
        source: 'Ajuste manual de estoque fisico',
      });
    }

    if (reservedDiff > 0) {
      movementsToRegister.push({
        product: productName,
        type: 'RESERVATION',
        quantity: reservedDiff,
        source: 'Ajuste manual de reservado',
      });
    } else if (reservedDiff < 0) {
      movementsToRegister.push({
        product: productName,
        type: 'RELEASE',
        quantity: Math.abs(reservedDiff),
        source: 'Liberacao manual de reservado',
      });
    }

    updateStockItemLocally(productId, {
      total: newTotal,
      reservado: newReserved,
    });

    if (movementsToRegister.length > 0) {
      onRegisterMovements(movementsToRegister);
    }
  };

  const handleSaveRow = async (productName: string) => {
    const stockItem = stock.find(item => item.produto === productName);
    const editable = editableRows[productName];

    if (!stockItem || !editable) {
      return;
    }

    const newTotal = Number(editable.total);
    const newReserved = Number(editable.reserved);

    if (!Number.isFinite(newTotal) || !Number.isFinite(newReserved) || newTotal < 0 || newReserved < 0) {
      setRowErrors(current => ({ ...current, [productName]: 'Valores invalidos. Use numeros positivos.' }));
      return;
    }

    if (newReserved > newTotal) {
      setRowErrors(current => ({ ...current, [productName]: 'Reservado nao pode ser maior que total.' }));
      return;
    }

    setRowErrors(current => ({ ...current, [productName]: '' }));

    const productId = String(getStockProductId(stockItem));

    await runWithFallback(
      `save-row:${productId}`,
      async () => {
        const inventoryPayload = buildInventoryUpdatePayload(stockItem, {
          total: newTotal,
        });

        if (inventoryPayload) {
          await updateInventory(productId, inventoryPayload);
        }

        applyStockUpdateLocally(
          productId,
          stockItem.produto,
          stockItem.total,
          stockItem.reservado,
          newTotal,
          newReserved,
        );
      },
      () => {
        applyStockUpdateLocally(
          productId,
          stockItem.produto,
          stockItem.total,
          stockItem.reservado,
          newTotal,
          newReserved,
        );
      },
    );
  };

  const applyImportedRowsLocally = (rows: Array<{ codigo: string; produto: string; total: number; reservado: number }>) => {
    let updatedCount = 0;
    const importMovements: Array<Omit<StockMovement, 'id' | 'createdAt'>> = [];

    setStock(currentStock => {
      const byProduct = new Map(currentStock.map(item => [item.produto, item]));

      rows.forEach(row => {
        if (!Number.isFinite(row.total) || !Number.isFinite(row.reservado) || row.total < 0 || row.reservado < 0 || row.reservado > row.total) {
          return;
        }

        const previous = byProduct.get(row.produto);
        if (!previous) {
          byProduct.set(row.produto, {
            codigo: row.codigo,
            produto: row.produto,
            total: row.total,
            reservado: row.reservado,
          });
          updatedCount += 1;

          if (row.total > 0) {
            importMovements.push({
              product: row.produto,
              type: 'ENTRY',
              quantity: row.total,
              source: 'Importacao CSV',
            });
          }

          if (row.reservado > 0) {
            importMovements.push({
              product: row.produto,
              type: 'RESERVATION',
              quantity: row.reservado,
              source: 'Importacao CSV',
            });
          }

          return;
        }

        const totalDiff = row.total - previous.total;
        const reservedDiff = row.reservado - previous.reservado;

        byProduct.set(row.produto, { ...previous, total: row.total, reservado: row.reservado });
        updatedCount += 1;

        if (totalDiff > 0) {
          importMovements.push({
            product: row.produto,
            type: 'ENTRY',
            quantity: totalDiff,
            source: 'Importacao CSV',
          });
        } else if (totalDiff < 0) {
          importMovements.push({
            product: row.produto,
            type: 'EXIT',
            quantity: Math.abs(totalDiff),
            source: 'Importacao CSV',
          });
        }

        if (reservedDiff > 0) {
          importMovements.push({
            product: row.produto,
            type: 'RESERVATION',
            quantity: reservedDiff,
            source: 'Importacao CSV',
          });
        } else if (reservedDiff < 0) {
          importMovements.push({
            product: row.produto,
            type: 'RELEASE',
            quantity: Math.abs(reservedDiff),
            source: 'Importacao CSV',
          });
        }
      });

      return Array.from(byProduct.values());
    });

    if (importMovements.length > 0) {
      onRegisterMovements(importMovements);
    }

    setImportFeedback(`${updatedCount} produto(s) processado(s) via CSV.`);
  };

  const parseCsvRows = (text: string) => {
    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      throw new Error('CSV vazio ou sem linhas de dados.');
    }

    const headers = lines[0].split(',').map(header => header.trim().toLowerCase());
    const productIndex = headers.findIndex(h => h === 'produto' || h === 'product');
    const totalIndex = headers.findIndex(h => h === 'total_quantity' || h === 'total');
    const reservedIndex = headers.findIndex(h => h === 'reserved_quantity' || h === 'reserved' || h === 'reservado');
    const codeIndex = headers.findIndex(h => h === 'codigo' || h === 'code' || h === 'sku');

    if (productIndex === -1 || totalIndex === -1 || reservedIndex === -1) {
      throw new Error('Cabecalho invalido. Use: produto,total_quantity,reserved_quantity');
    }

    return lines.slice(1)
      .map(line => {
        const cols = line.split(',').map(col => col.trim());
        const fallbackCode = `CSV-${cols[productIndex]?.replace(/\s+/g, '-').toUpperCase()}`;
        return {
          codigo: codeIndex >= 0 ? cols[codeIndex] : fallbackCode,
          produto: cols[productIndex],
          total: Number(cols[totalIndex]),
          reservado: Number(cols[reservedIndex]),
        };
      })
      .filter(row => row.produto);
  };

  const handleImportCsv = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setImportFeedback('');
    setImportError('');

    try {
      setIsSyncingStock('import-csv');
      await importInventoryCsv(file);

      try {
        const latestMovements = await getInventoryMovements();
        const mapped = latestMovements.map((movement, index) => ({
          id: typeof movement.id === 'string' ? movement.id : `${Date.now()}-${index}`,
          product: movement.productName ?? movement.productId ?? 'Produto',
          type: normalizeMovementType(movement.type),
          quantity: typeof movement.quantity === 'number' ? movement.quantity : 0,
          source: movement.source ?? 'Movimentacao API',
          createdAt: movement.createdAt ?? new Date().toISOString(),
        }));

        setApiMovements(mapped);
      } catch {
        setApiMovements(null);
      }

      setImportFeedback('Importacao enviada para API com sucesso.');
      setUsingLocalStockFallback(false);
      event.target.value = '';
    } catch {
      // fallback local para demonstracao enquanto o endpoint de importacao nao esta disponivel
      try {
        const text = await file.text();
        const rows = parseCsvRows(text);
        applyImportedRowsLocally(rows);
        setImportFeedback('API indisponivel. A importacao foi simulada localmente.');
        setUsingLocalStockFallback(true);
      } catch (parseError) {
        setImportError(getApiErrorMessage(parseError));
      }

      event.target.value = '';
    } finally {
      setIsSyncingStock('');
    }
  };

  const effectiveMovements = apiMovements ?? movements;

  const filteredMovements = useMemo(() => {
    return effectiveMovements
      .filter(movement => {
        if (movementTypeFilter !== 'ALL' && movement.type !== movementTypeFilter) {
          return false;
        }

        const movementDate = toInputDate(movement.createdAt);
        if (startDate && movementDate < startDate) {
          return false;
        }

        if (endDate && movementDate > endDate) {
          return false;
        }

        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [effectiveMovements, movementTypeFilter, startDate, endDate]);

  const filteredStock = stock.filter(item => {
    const available = item.total - item.reservado;
    const isLowStock = available <= 20;

    if (showOnlyLowStock && !isLowStock) {
      return false;
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesCodigo = item.codigo.toLowerCase().includes(searchLower);
      const matchesProduto = item.produto.toLowerCase().includes(searchLower);

      if (!matchesCodigo && !matchesProduto) {
        return false;
      }
    }

    return true;
  });

  const handleAddNewProduct = async () => {
    const { codigo, produto, total, reservado, fotoUrl } = newProduct;

    if (!codigo.trim() || !produto.trim()) {
      setImportFeedback('Codigo e descricao sao obrigatorios.');
      return;
    }

    const totalNum = Number(total);
    const reservadoNum = Number(reservado);

    if (!Number.isFinite(totalNum) || !Number.isFinite(reservadoNum) || totalNum < 0 || reservadoNum < 0) {
      setImportFeedback('Valores invalidos. Use numeros positivos.');
      return;
    }

    if (reservadoNum > totalNum) {
      setImportFeedback('Reservado nao pode ser maior que total.');
      return;
    }

    if (stock.some(item => item.codigo.toLowerCase() === codigo.toLowerCase())) {
      setImportFeedback('Produto com este codigo ja existe.');
      return;
    }

    const localInsert = () => {
      setStock(currentStock => [
        ...currentStock,
        {
          codigo,
          produto,
          total: totalNum,
          reservado: reservadoNum,
          fotoUrl: fotoUrl || undefined,
        },
      ]);

      const movementsToRegister: Array<Omit<StockMovement, 'id' | 'createdAt'>> = [];
      if (totalNum > 0) {
        movementsToRegister.push({
          product: produto,
          type: 'ENTRY',
          quantity: totalNum,
          source: 'Novo produto cadastrado',
        });
      }
      if (reservadoNum > 0) {
        movementsToRegister.push({
          product: produto,
          type: 'RESERVATION',
          quantity: reservadoNum,
          source: 'Novo produto cadastrado',
        });
      }

      if (movementsToRegister.length > 0) {
        onRegisterMovements(movementsToRegister);
      }
    };

    await runWithFallback(
      `create-product:${codigo}`,
      async () => {
        await createProduct({
          name: produto,
          minStockLevel: 0,
        });

        localInsert();
      },
      localInsert,
    );

    setImportFeedback(`Produto "${produto}" cadastrado com sucesso!`);
    setNewProduct({ codigo: '', produto: '', total: '0', reservado: '0', fotoUrl: '' });
    setShowNewProductForm(false);
  };

  const handleOpenEditModal = (item: StockItem) => {
    setEditModalError('');
    setEditingProduct({
      originalCodigo: item.codigo,
      codigo: item.codigo,
      produto: item.produto,
      total: String(item.total),
      reservado: String(item.reservado),
      fotoUrl: item.fotoUrl ?? '',
    });
  };

  const handleSaveProductFromModal = async () => {
    if (!editingProduct) {
      return;
    }

    const codigo = editingProduct.codigo.trim();
    const produto = editingProduct.produto.trim();
    const total = Number(editingProduct.total);
    const reservado = Number(editingProduct.reservado);
    const fotoUrl = editingProduct.fotoUrl.trim();

    if (!codigo || !produto) {
      setEditModalError('Codigo e descricao sao obrigatorios.');
      return;
    }

    if (!Number.isFinite(total) || !Number.isFinite(reservado) || total < 0 || reservado < 0) {
      setEditModalError('Valores invalidos. Use numeros positivos.');
      return;
    }

    if (reservado > total) {
      setEditModalError('Reservado nao pode ser maior que total.');
      return;
    }

    const duplicateCode = stock.some(
      item => item.codigo.toLowerCase() === codigo.toLowerCase() && item.codigo !== editingProduct.originalCodigo,
    );
    if (duplicateCode) {
      setEditModalError('Ja existe um produto com este codigo.');
      return;
    }

    const previous = stock.find(item => item.codigo === editingProduct.originalCodigo);
    if (!previous) {
      setEditModalError('Produto nao encontrado para edicao.');
      return;
    }

    const totalDiff = total - previous.total;
    const reservedDiff = reservado - previous.reservado;
    const movementsToRegister: Array<Omit<StockMovement, 'id' | 'createdAt'>> = [];

    if (totalDiff > 0) {
      movementsToRegister.push({
        product: produto,
        type: 'ENTRY',
        quantity: totalDiff,
        source: 'Ajuste via edicao do produto',
      });
    } else if (totalDiff < 0) {
      movementsToRegister.push({
        product: produto,
        type: 'EXIT',
        quantity: Math.abs(totalDiff),
        source: 'Ajuste via edicao do produto',
      });
    }

    if (reservedDiff > 0) {
      movementsToRegister.push({
        product: produto,
        type: 'RESERVATION',
        quantity: reservedDiff,
        source: 'Ajuste via edicao do produto',
      });
    } else if (reservedDiff < 0) {
      movementsToRegister.push({
        product: produto,
        type: 'RELEASE',
        quantity: Math.abs(reservedDiff),
        source: 'Ajuste via edicao do produto',
      });
    }

    const productId = String(getStockProductId(previous));

    const localUpdate = () => {
      updateStockItemLocally(productId, {
        codigo,
        produto,
        total,
        reservado,
        fotoUrl: fotoUrl || undefined,
      });

      if (movementsToRegister.length > 0) {
        onRegisterMovements(movementsToRegister);
      }
    };

    await runWithFallback(
      `update-product:${productId}`,
      async () => {
        await updateProduct(productId, {
          name: produto,
          minStockLevel: 0,
        });

        const inventoryPayload = buildInventoryUpdatePayload(previous, {
          total,
        });

        if (inventoryPayload) {
          await updateInventory(productId, inventoryPayload);
        }

        localUpdate();
      },
      localUpdate,
    );

    setImportFeedback(`Produto "${produto}" atualizado com sucesso.`);
    setEditingProduct(null);
    setEditModalError('');
  };

  const handleDeleteProductFromModal = async () => {
    if (!editingProduct) {
      return;
    }

    const previous = stock.find(item => item.codigo === editingProduct.originalCodigo);
    if (!previous) {
      setEditModalError('Produto nao encontrado para exclusao.');
      return;
    }

    const productId = String(getStockProductId(previous));

    const localDelete = () => {
      setStock(currentStock => currentStock.filter(item => getStockProductId(item) !== productId));

      if (previous.total > 0) {
        onRegisterMovements([
          {
            product: previous.produto,
            type: 'EXIT',
            quantity: previous.total,
            source: 'Produto removido do catalogo',
          },
        ]);
      }
    };

    await runWithFallback(
      `delete-product:${productId}`,
      async () => {
        await deleteProduct(productId);
        localDelete();
      },
      localDelete,
    );

    setImportFeedback(`Produto "${previous.produto}" removido.`);
    setEditingProduct(null);
    setEditModalError('');
  };

  return (
    <div className="mt-8">
      <section className="bg-[#141414] dark:bg-[#141414] light:bg-white border border-[#222222] light:border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#222222] light:border-gray-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold !text-white dark:!text-white light:!text-gray-900">Estoque fisico</h2>
            <p className="text-sm text-gray-500 light:text-gray-600">Disponivel = Total - Reservado</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center w-full md:w-auto">
            <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-[#2a2a2a] light:border-gray-300 bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 flex-1 md:flex-none">
              <span className="text-gray-500">🔍</span>
              <input
                type="text"
                placeholder="Buscar codigo ou produto..."
                value={searchTerm}
                onChange={event => setSearchTerm(event.target.value)}
                className="bg-transparent text-xs text-white dark:text-white light:text-gray-900 outline-none flex-1 md:w-48"
              />
            </div>
            <label className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md border border-[#2a2a2a] light:border-gray-300 text-gray-300 light:text-gray-700 cursor-pointer hover:bg-[#1a1a1a] dark:hover:bg-[#1a1a1a] light:hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={showOnlyLowStock}
                onChange={event => setShowOnlyLowStock(event.target.checked)}
                className="w-4 h-4 cursor-pointer"
              />
              <span>Apenas baixo estoque</span>
            </label>
            <button
              type="button"
              onClick={() => setShowNewProductForm(!showNewProductForm)}
              disabled={Boolean(isSyncingStock)}
              className="text-xs px-3 py-2 rounded-md border border-[#2a2a2a] light:border-gray-300 text-gray-300 light:text-gray-700 hover:bg-[#1a1a1a] dark:hover:bg-[#1a1a1a] light:hover:bg-gray-100 transition-colors disabled:opacity-60"
            >
              {showNewProductForm ? '✕ Cancelar' : '+ Novo produto'}
            </button>
            <button
              type="button"
              onClick={() => setShowMovementHistory(!showMovementHistory)}
              className="text-xs px-3 py-2 rounded-md border border-[#2a2a2a] light:border-gray-300 text-gray-300 light:text-gray-700 hover:bg-[#1a1a1a] dark:hover:bg-[#1a1a1a] light:hover:bg-gray-100 transition-colors"
            >
              {showMovementHistory ? '✕ Fechar historico' : '+ Historico de movimentacoes'}
            </button>
            <label className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-md border border-[#2a2a2a] light:border-gray-300 text-gray-300 light:text-gray-700 cursor-pointer hover:bg-[#1a1a1a] dark:hover:bg-[#1a1a1a] light:hover:bg-gray-100 transition-colors">
              Importar CSV
              <input type="file" accept=".csv" className="hidden" onChange={handleImportCsv} disabled={isSyncingStock === 'import-csv'} />
            </label>
          </div>
        </div>

        {isSyncingStock && (
          <p className="px-5 py-3 text-xs text-gray-400 light:text-gray-600 border-b border-[#222222] light:border-gray-200">Sincronizando alteracao de estoque...</p>
        )}

        {stockActionError && (
          <p className="px-5 py-3 text-xs text-amber-300 light:text-amber-700 border-b border-[#222222] light:border-gray-200">{stockActionError}</p>
        )}

        {usingLocalStockFallback && (
          <p className="px-5 py-3 text-xs text-amber-300 light:text-amber-700 border-b border-[#222222] light:border-gray-200">
            API indisponivel. Algumas alteracoes estao sendo simuladas localmente.
          </p>
        )}

        {importFeedback && (
          <p className="px-5 py-3 text-sm text-[#00ff66] light:text-green-700 border-b border-[#222222] light:border-gray-200">{importFeedback}</p>
        )}

        {importError && (
          <p className="px-5 py-3 text-sm text-red-400 light:text-red-700 border-b border-[#222222] light:border-gray-200">{importError}</p>
        )}

        {showNewProductForm && (
          <div className="px-5 py-4 bg-[#0a0a0a] dark:bg-[#0a0a0a] light:bg-gray-50 border-b border-[#222222] light:border-gray-200">
            <h3 className="text-sm font-semibold !text-white dark:!text-white light:!text-gray-900 mb-3">Cadastrar novo produto</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
              <div>
                <label className="text-xs text-gray-400 light:text-gray-600">Codigo</label>
                <input
                  type="text"
                  value={newProduct.codigo}
                  onChange={event => setNewProduct({ ...newProduct, codigo: event.target.value })}
                  placeholder="Ex: ARR001"
                  className="w-full rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-2 text-xs text-white dark:text-white light:text-gray-900 mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 light:text-gray-600">Descricao</label>
                <input
                  type="text"
                  value={newProduct.produto}
                  onChange={event => setNewProduct({ ...newProduct, produto: event.target.value })}
                  placeholder="Ex: Arroz 5kg"
                  className="w-full rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-2 text-xs text-white dark:text-white light:text-gray-900 mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 light:text-gray-600">Total</label>
                <input
                  type="number"
                  value={newProduct.total}
                  onChange={event => setNewProduct({ ...newProduct, total: event.target.value })}
                  min={0}
                  className="w-full rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-2 text-xs text-white dark:text-white light:text-gray-900 mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 light:text-gray-600">Reservado</label>
                <input
                  type="number"
                  value={newProduct.reservado}
                  onChange={event => setNewProduct({ ...newProduct, reservado: event.target.value })}
                  min={0}
                  className="w-full rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-2 text-xs text-white dark:text-white light:text-gray-900 mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 light:text-gray-600">Foto</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async event => {
                    const file = event.target.files?.[0];
                    if (!file) {
                      return;
                    }
                    try {
                      const foto = await fileToDataUrl(file);
                      setNewProduct(current => ({ ...current, fotoUrl: foto }));
                    } catch {
                      setImportFeedback('Nao foi possivel carregar a foto do produto.');
                    }
                    event.target.value = '';
                  }}
                  className="w-full rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-1.5 text-xs text-white dark:text-white light:text-gray-900 mt-1 file:mr-2 file:border-0 file:bg-transparent file:text-xs file:text-gray-400"
                />
                {newProduct.fotoUrl && (
                  <img
                    src={newProduct.fotoUrl}
                    alt="Preview do produto"
                    className="mt-2 h-14 w-14 rounded-md object-cover border border-[#2a2a2a] light:border-gray-300"
                  />
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleAddNewProduct}
              disabled={Boolean(isSyncingStock)}
              className="text-xs px-3 py-2 rounded-md bg-[#00ff66]/15 text-[#00ff66] light:bg-green-100 light:text-green-700 hover:bg-[#00ff66]/25 transition-colors mt-3 disabled:opacity-60"
            >
              ✓ Cadastrar produto
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-[#222222] light:border-gray-200 text-left">
                <th className="px-5 py-3 text-xs uppercase tracking-wide text-gray-500">Codigo</th>
                <th className="px-5 py-3 text-xs uppercase tracking-wide text-gray-500">Produto</th>
                <th className="px-5 py-3 text-xs uppercase tracking-wide text-gray-500">Total</th>
                <th className="px-5 py-3 text-xs uppercase tracking-wide text-gray-500">Reservado</th>
                <th className="px-5 py-3 text-xs uppercase tracking-wide text-gray-500">Disponivel</th>
                <th className="px-5 py-3 text-xs uppercase tracking-wide text-gray-500">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {filteredStock.map(item => {
                const available = item.total - item.reservado;
                const isLowStock = available <= 20;
                const rowEdit = editableRows[item.produto] ?? { total: String(item.total), reserved: String(item.reservado) };
                const rowSyncKey = `save-row:${String(getStockProductId(item))}`;

                return (
                  <tr key={item.produto} className={`border-b border-[#222222] light:border-gray-200 transition-colors ${isLowStock ? 'bg-amber-500/10 dark:bg-amber-500/10 light:bg-amber-50' : ''}`}>
                    <td className="px-5 py-4 text-sm text-gray-400 light:text-gray-600">
                      {item.codigo}
                    </td>
                    <td className={`px-5 py-4 text-sm ${isLowStock ? 'text-amber-300 dark:text-amber-300 light:text-amber-800 font-semibold' : 'text-white dark:text-white light:text-gray-900'}`}>
                      <div className="flex items-center gap-2">
                        {isLowStock && <span className="text-amber-400 dark:text-amber-400 light:text-amber-700">⚠</span>}
                        {item.produto}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <input
                        type="number"
                        min={0}
                        value={rowEdit.total}
                        onChange={event => {
                          const value = event.target.value;
                          setEditableRows(current => ({
                            ...current,
                            [item.produto]: {
                              total: value,
                              reserved: current[item.produto]?.reserved ?? String(item.reservado),
                            },
                          }));
                        }}
                        className="w-24 rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-1 text-xs text-white dark:text-white light:text-gray-900"
                      />
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <input
                        type="number"
                        min={0}
                        value={rowEdit.reserved}
                        onChange={event => {
                          const value = event.target.value;
                          setEditableRows(current => ({
                            ...current,
                            [item.produto]: {
                              total: current[item.produto]?.total ?? String(item.total),
                              reserved: value,
                            },
                          }));
                        }}
                        className="w-24 rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-1 text-xs text-white dark:text-white light:text-gray-900"
                      />
                    </td>
                    <td className={`px-5 py-4 text-sm ${isLowStock ? 'bg-amber-500/20 dark:bg-amber-500/20 light:bg-amber-100' : ''}`}>
                      {isLowStock ? (
                        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-amber-500/30 dark:bg-amber-500/30 light:bg-amber-200 border border-amber-400 dark:border-amber-400 light:border-amber-600">
                          <span className="font-semibold text-amber-300 dark:text-amber-300 light:text-amber-900">{available}</span>
                          <span className="text-xs text-amber-400 dark:text-amber-400 light:text-amber-700 font-semibold">CRITICO</span>
                        </div>
                      ) : (
                        <span className="text-gray-300 light:text-gray-700">{available}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void handleSaveRow(item.produto);
                          }}
                          disabled={isSyncingStock === rowSyncKey}
                          className="text-xs px-2.5 py-1 rounded-md bg-[#00ff66]/15 text-[#00ff66] light:bg-green-100 light:text-green-700 hover:bg-[#00ff66]/25 transition-colors disabled:opacity-60"
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          disabled={Boolean(isSyncingStock)}
                          className="text-xs px-2.5 py-1 rounded-md bg-sky-500/15 text-sky-300 light:bg-sky-100 light:text-sky-700 hover:bg-sky-500/25 transition-colors disabled:opacity-60"
                        >
                          Editar
                        </button>
                      </div>
                      {rowErrors[item.produto] && (
                        <p className="mt-1 text-xs text-red-400 light:text-red-700">{rowErrors[item.produto]}</p>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {showMovementHistory && (
          <div className="border-t border-[#222222] light:border-gray-200">
            <div className="px-5 py-4 bg-[#0a0a0a] dark:bg-[#0a0a0a] light:bg-gray-50">
              <h3 className="text-sm font-semibold !text-white dark:!text-white light:!text-gray-900 mb-3">Historico de movimentacoes</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select
                  value={movementTypeFilter}
                  onChange={event => setMovementTypeFilter(event.target.value as 'ALL' | StockMovementType)}
                  className="rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-2 text-xs text-white dark:text-white light:text-gray-900"
                >
                  <option value="ALL">Todos os tipos</option>
                  <option value="ENTRY">ENTRY</option>
                  <option value="RESERVATION">RESERVATION</option>
                  <option value="RELEASE">RELEASE</option>
                  <option value="EXIT">EXIT</option>
                </select>
                <input
                  type="date"
                  value={startDate}
                  onChange={event => setStartDate(event.target.value)}
                  className="rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-2 text-xs text-white dark:text-white light:text-gray-900"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={event => setEndDate(event.target.value)}
                  className="rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-2 text-xs text-white dark:text-white light:text-gray-900"
                />
              </div>
            </div>

            <div className="max-h-[400px] overflow-y-auto p-4 space-y-2 bg-[#0a0a0a] dark:bg-[#0a0a0a] light:bg-gray-50">
              {filteredMovements.length === 0 && (
                <p className="text-sm text-gray-500 light:text-gray-600">Nenhuma movimentacao para os filtros selecionados.</p>
              )}

              {filteredMovements.map(movement => (
                <div key={movement.id} className="rounded-lg border border-[#2a2a2a] light:border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-white dark:text-white light:text-gray-900">{movement.product}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${movementTypeClass[movement.type]}`}>
                      {movementTypeLabels[movement.type]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 light:text-gray-600 mt-1">Quantidade: {movement.quantity}</p>
                  <p className="text-xs text-gray-500 mt-1">{movement.source}</p>
                  <p className="text-[11px] text-gray-500 mt-1">{toLocalDateTime(movement.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {editingProduct && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-xl border border-[#2a2a2a] light:border-gray-300 bg-[#141414] dark:bg-[#141414] light:bg-white overflow-hidden">
              <div className="px-5 py-4 border-b border-[#222222] light:border-gray-200 flex items-center justify-between">
                <h3 className="text-base font-semibold text-white dark:text-white light:text-gray-900">Editar produto</h3>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setEditModalError('');
                  }}
                  className="text-sm px-2 py-1 rounded-md border border-[#2a2a2a] light:border-gray-300 text-gray-300 light:text-gray-700 hover:bg-[#1a1a1a] light:hover:bg-gray-100"
                >
                  Fechar
                </button>
              </div>

              <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 light:text-gray-600">Codigo</label>
                  <input
                    type="text"
                    value={editingProduct.codigo}
                    onChange={event => setEditingProduct(current => (current ? { ...current, codigo: event.target.value } : null))}
                    className="w-full rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-2 text-xs text-white dark:text-white light:text-gray-900 mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 light:text-gray-600">Descricao</label>
                  <input
                    type="text"
                    value={editingProduct.produto}
                    onChange={event => setEditingProduct(current => (current ? { ...current, produto: event.target.value } : null))}
                    className="w-full rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-2 text-xs text-white dark:text-white light:text-gray-900 mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 light:text-gray-600">Total</label>
                  <input
                    type="number"
                    min={0}
                    value={editingProduct.total}
                    onChange={event => setEditingProduct(current => (current ? { ...current, total: event.target.value } : null))}
                    className="w-full rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-2 text-xs text-white dark:text-white light:text-gray-900 mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 light:text-gray-600">Reservado</label>
                  <input
                    type="number"
                    min={0}
                    value={editingProduct.reservado}
                    onChange={event => setEditingProduct(current => (current ? { ...current, reservado: event.target.value } : null))}
                    className="w-full rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-2 text-xs text-white dark:text-white light:text-gray-900 mt-1"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-gray-400 light:text-gray-600">Foto</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async event => {
                      const file = event.target.files?.[0];
                      if (!file) {
                        return;
                      }
                      try {
                        const foto = await fileToDataUrl(file);
                        setEditingProduct(current => (current ? { ...current, fotoUrl: foto } : null));
                      } catch {
                        setEditModalError('Nao foi possivel carregar a foto do produto.');
                      }
                      event.target.value = '';
                    }}
                    className="w-full rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-1.5 text-xs text-white dark:text-white light:text-gray-900 mt-1 file:mr-2 file:border-0 file:bg-transparent file:text-xs file:text-gray-400"
                  />
                  {editingProduct.fotoUrl && (
                    <img
                      src={editingProduct.fotoUrl}
                      alt="Foto do produto"
                      className="mt-2 h-20 w-20 rounded-md object-cover border border-[#2a2a2a] light:border-gray-300"
                    />
                  )}
                </div>
              </div>

              {editModalError && <p className="px-5 pb-2 text-xs text-red-400 light:text-red-700">{editModalError}</p>}

              <div className="px-5 py-4 border-t border-[#222222] light:border-gray-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setEditModalError('');
                  }}
                  className="text-xs px-3 py-2 rounded-md border border-[#2a2a2a] light:border-gray-300 text-gray-300 light:text-gray-700 hover:bg-[#1a1a1a] light:hover:bg-gray-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleDeleteProductFromModal();
                  }}
                  disabled={Boolean(isSyncingStock)}
                  className="text-xs px-3 py-2 rounded-md border border-rose-500/50 text-rose-300 light:text-rose-700 hover:bg-rose-500/10 transition-colors disabled:opacity-60"
                >
                  Excluir produto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleSaveProductFromModal();
                  }}
                  disabled={Boolean(isSyncingStock)}
                  className="text-xs px-3 py-2 rounded-md bg-[#00ff66]/15 text-[#00ff66] light:bg-green-100 light:text-green-700 hover:bg-[#00ff66]/25 transition-colors disabled:opacity-60"
                >
                  Salvar alteracoes
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
