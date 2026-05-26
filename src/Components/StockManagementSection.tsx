import { useEffect, useMemo, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { ApiError } from '../services/api';
import { getInventoryMovements, isInventoryProductId, updateInventory } from '../services/inventory';
import { createProduct, deleteProduct, updateProduct } from '../services/products';
import type { StockItem, StockMovement, StockMovementType } from '../types/orders';
import type { StockMovementResponse } from '../types/inventory';

interface StockManagementSectionProps {
  stock: StockItem[];
  setStock: Dispatch<SetStateAction<StockItem[]>>;
  movements: StockMovement[];
  onRegisterMovements: (movements: Array<Omit<StockMovement, 'id' | 'createdAt'>>) => void;
}

type EditableRowState = Record<string, { total: string; reserved: string }>;
type ProductEditState = {
  productId: string;
  produto: string;
  minStockLevel: string;
  imageUrl: string;
};

type StockIdentity = StockItem & {
  productId?: string;
  id?: string;
  inventoryId?: string;
  supplierId?: string;
  minStockLevel?: number;
  imageUrl?: string;
  totalQuantity?: number;
  reservedQuantity?: number;
  availableQuantity?: number;
  badges?: string[];
};

function getRealProductId(item: StockItem): string | undefined {
  const stockIdentity = item as StockIdentity;
  return stockIdentity.productId || stockIdentity.id;
}

function isValidApiId(id?: string): id is string {
  return isInventoryProductId(id);
}

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

function normalizeMovementType(value: string): StockMovementType {
  if (value === 'ENTRY' || value === 'RESERVATION' || value === 'RELEASE' || value === 'EXIT') {
    return value;
  }

  return 'ENTRY';
}

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

export function StockManagementSection({ stock, setStock, movements }: StockManagementSectionProps) {
  const [editableRows, setEditableRows] = useState<EditableRowState>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [importFeedback, setImportFeedback] = useState('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<'ALL' | StockMovementType>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showOnlyLowStock, setShowOnlyLowStock] = useState(false);
  const [showMovementHistory, setShowMovementHistory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ produto: '', minStockLevel: '0', imageUrl: '' });
  const [editingProduct, setEditingProduct] = useState<ProductEditState | null>(null);
  const [editModalError, setEditModalError] = useState('');
  const [isSyncingStock, setIsSyncingStock] = useState('');
  const [stockActionError, setStockActionError] = useState('');
  const [usingLocalStockFallback, setUsingLocalStockFallback] = useState(false);
  const [apiMovements, setApiMovements] = useState<StockMovement[] | null>(null);

  const getStockProductId = (item: StockItem) => {
    return getRealProductId(item) ?? item.codigo ?? item.produto;
  };

  const getMinStockLevel = (item: StockItem) => {
    const stockIdentity = item as StockIdentity;
    return typeof stockIdentity.minStockLevel === 'number' && Number.isFinite(stockIdentity.minStockLevel)
      ? stockIdentity.minStockLevel
      : 0;
  };

  const mapMovement = (movement: StockMovementResponse, index: number): StockMovement => ({
    id: typeof movement.id === 'string' && movement.id.trim() ? movement.id : `${Date.now()}-${index}`,
    product: movement.productId,
    type: normalizeMovementType(movement.movementType),
    quantity: typeof movement.quantity === 'number' ? movement.quantity : 0,
    source: movement.reason ?? movement.referenceId ?? 'Movimentacao de estoque',
    createdAt: movement.createdAt,
  });

  const updateStockItemLocally = (
    productId: string,
    changes: Partial<StockIdentity>,
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

  useEffect(() => {
    const nextEditableRows = stock.reduce<EditableRowState>((acc, item) => {
      const rowId = getStockProductId(item);

      acc[rowId] = {
        total: String(item.total),
        reserved: String(item.reservado),
      };
      return acc;
    }, {});

    setEditableRows(nextEditableRows);
  }, [stock]);

  useEffect(() => {
    if (!showMovementHistory) {
      return;
    }

    let active = true;

    const loadMovements = async () => {
      try {
        const response = await getInventoryMovements();
        if (!active) {
          return;
        }

        setApiMovements(response.map(mapMovement));
      } catch {
        if (!active) {
          return;
        }

        setApiMovements([]);
      }
    };

    void loadMovements();

    return () => {
      active = false;
    };
  }, [showMovementHistory]);

  const handleSaveRow = async (rowId: string) => {
    const stockItem = stock.find(item => getStockProductId(item) === rowId);
    const editable = editableRows[rowId];

    if (!stockItem || !editable) {
      return;
    }

    const stockIdentity = stockItem as StockIdentity;

    const nextTotal = Number(editable.total);
    if (!Number.isFinite(nextTotal) || nextTotal < 0) {
      setRowErrors(current => ({ ...current, [rowId]: 'Valores invalidos. Use numeros positivos.' }));
      return;
    }

    const productId = getRealProductId(stockItem);
    if (!isValidApiId(productId)) {
      setRowErrors(current => ({ ...current, [rowId]: '' }));
      setStockActionError('Produto sem ID real: não foi possível ajustar estoque.');
      setEditableRows(current => ({
        ...current,
        [rowId]: {
          total: String(stockIdentity.totalQuantity ?? stockItem.total),
          reserved: String(stockIdentity.reservedQuantity ?? stockItem.reservado),
        },
      }));
      return;
    }

    const currentTotal = stockIdentity.totalQuantity ?? stockItem.total;
    const quantityToAdd = nextTotal - currentTotal;

    if (quantityToAdd === 0) {
      setRowErrors(current => ({ ...current, [rowId]: '' }));
      setStockActionError('Nenhuma alteração de estoque identificada.');
      setEditableRows(current => ({
        ...current,
        [rowId]: {
          total: String(currentTotal),
          reserved: String(stockIdentity.reservedQuantity ?? stockItem.reservado),
        },
      }));
      return;
    }

    if (quantityToAdd < 0) {
      setRowErrors(current => ({ ...current, [rowId]: '' }));
      setStockActionError('O backend atual permite apenas entrada de estoque. Para reduzir o total, será necessário endpoint específico.');
      setEditableRows(current => ({
        ...current,
        [rowId]: {
          total: String(currentTotal),
          reserved: String(stockIdentity.reservedQuantity ?? stockItem.reservado),
        },
      }));
      return;
    }

    setIsSyncingStock(`save-row:${productId}`);
    setStockActionError('');
    setRowErrors(current => ({ ...current, [rowId]: '' }));

    try {
      const inventory = await updateInventory(productId, {
        quantity: quantityToAdd,
        reason: 'Entrada manual no painel web',
      });

      updateStockItemLocally(productId, {
        id: inventory.productId,
        productId: inventory.productId,
        inventoryId: inventory.inventoryId,
        supplierId: inventory.supplierId,
        total: inventory.totalQuantity,
        reservado: inventory.reservedQuantity,
        totalQuantity: inventory.totalQuantity,
        reservedQuantity: inventory.reservedQuantity,
        availableQuantity: inventory.availableQuantity,
        badges: inventory.badges,
      });

      setImportFeedback('Estoque atualizado com sucesso.');

      if (showMovementHistory) {
        const refreshedMovements = await getInventoryMovements();
        setApiMovements(refreshedMovements.map(mapMovement));
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setStockActionError('Você não tem permissão para ajustar o estoque deste produto.');
      } else if (error instanceof ApiError && error.status === 404) {
        setStockActionError('Produto não encontrado no backend ou estoque ainda não inicializado. Alteração não salva.');
      } else if (error instanceof ApiError && error.status >= 500) {
        setStockActionError('Erro interno ao ajustar estoque. Tente novamente em instantes.');
      } else {
        setStockActionError(getApiErrorMessage(error));
      }

      setEditableRows(current => ({
        ...current,
        [rowId]: {
          total: String(stockIdentity.totalQuantity ?? currentTotal),
          reserved: String(stockIdentity.reservedQuantity ?? stockItem.reservado),
        },
      }));
    } finally {
      setIsSyncingStock('');
    }
  };

  const handleImportCsvDisabled = () => {
    setStockActionError('Importação CSV será configurada na próxima etapa.');
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
    const minStockLevel = getMinStockLevel(item);
    const isLowStock = minStockLevel > 0 && available <= minStockLevel;

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
    const { produto, minStockLevel, imageUrl } = newProduct;

    if (!produto.trim()) {
      setImportFeedback('Nome do produto e obrigatorio.');
      return;
    }

    const minStockLevelNumber = Number(minStockLevel);

    if (!Number.isFinite(minStockLevelNumber) || minStockLevelNumber < 0) {
      setImportFeedback('Estoque minimo invalido. Use numero positivo.');
      return;
    }

    const localInsert = (productId: string, supplierId = '', isMock = false) => {
      const normalizedName = produto.trim();
      const resolvedId = isMock ? productId : productId.trim();
      setStock(currentStock => [
        ...currentStock,
        {
          codigo: resolvedId,
          produto: normalizedName,
          name: normalizedName,
          total: 0,
          reservado: 0,
          fotoUrl: imageUrl.trim() || undefined,
          id: resolvedId,
          productId: resolvedId,
          supplierId,
          minStockLevel: minStockLevelNumber,
          imageUrl: imageUrl.trim() || undefined,
          totalQuantity: 0,
          reservedQuantity: 0,
          availableQuantity: 0,
          badges: [],
        } as StockItem,
      ]);

      return resolvedId;
    };

    setIsSyncingStock(`create-product:${produto.trim()}`);
    setStockActionError('');

    try {
      const apiProduct = await createProduct({
        name: produto.trim(),
        minStockLevel: minStockLevelNumber,
        imageUrl: imageUrl.trim() || undefined,
      });

      localInsert(apiProduct.id, apiProduct.supplierId);
      setImportFeedback(`Produto "${apiProduct.name}" cadastrado com sucesso!`);

      setUsingLocalStockFallback(false);
      setNewProduct({ produto: '', minStockLevel: '0', imageUrl: '' });
      setShowNewProductForm(false);
    } catch {
      localInsert(`mock-${Date.now()}`, '', true);
      setUsingLocalStockFallback(true);
      setStockActionError('API indisponivel. A alteracao foi simulada localmente.');
      setImportFeedback(`Produto "${produto}" cadastrado localmente.`);
      setNewProduct({ produto: '', minStockLevel: '0', imageUrl: '' });
      setShowNewProductForm(false);
    } finally {
      setIsSyncingStock('');
    }
  };

  const handleOpenEditModal = (item: StockItem) => {
    const stockIdentity = item as StockIdentity;
    setEditModalError('');
    setEditingProduct({
      productId: String(getStockProductId(item)),
      produto: item.produto,
      minStockLevel: String(stockIdentity.minStockLevel ?? 0),
      imageUrl: stockIdentity.imageUrl ?? item.fotoUrl ?? '',
    });
  };

  const handleSaveProductFromModal = async () => {
    if (!editingProduct) {
      return;
    }

    const productId = editingProduct.productId;
    const produto = editingProduct.produto.trim();
    const minStockLevelNumber = Number(editingProduct.minStockLevel);
    const imageUrl = editingProduct.imageUrl.trim();

    if (!produto) {
      setEditModalError('Nome do produto e obrigatorio.');
      return;
    }

    if (!Number.isFinite(minStockLevelNumber) || minStockLevelNumber < 0) {
      setEditModalError('Estoque minimo invalido. Use numero positivo.');
      return;
    }

    const previous = stock.find(item => String(getStockProductId(item)) === productId);
    if (!previous) {
      setEditModalError('Produto nao encontrado para edicao.');
      return;
    }

    const realProductId = getRealProductId(previous);

    const localUpdate = () => {
      updateStockItemLocally(productId, {
        produto,
        minStockLevel: minStockLevelNumber,
        imageUrl: imageUrl || undefined,
        fotoUrl: imageUrl || undefined,
      } as Partial<StockIdentity>);
    };

    if (!isValidApiId(realProductId)) {
      localUpdate();
      setStockActionError('Produto sem ID real: ação simulada localmente.');
      setImportFeedback(`Produto "${produto}" atualizado localmente.`);
      setEditingProduct(null);
      setEditModalError('');
      return;
    }

    setIsSyncingStock(`update-product:${realProductId}`);
    setEditModalError('');

    try {
      const apiProduct = await updateProduct(realProductId, {
        name: produto,
        minStockLevel: minStockLevelNumber,
        imageUrl: imageUrl || undefined,
      });

      updateStockItemLocally(productId, {
        id: apiProduct.id,
        productId: apiProduct.id,
        supplierId: apiProduct.supplierId,
        codigo: apiProduct.id,
        name: apiProduct.name,
        produto: apiProduct.name,
        minStockLevel: apiProduct.minStockLevel,
        imageUrl: apiProduct.imageUrl,
        fotoUrl: apiProduct.imageUrl,
      } as Partial<StockIdentity>);

      setImportFeedback(`Produto "${apiProduct.name}" atualizado com sucesso.`);
      setEditingProduct(null);
      setEditModalError('');
      setUsingLocalStockFallback(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setEditModalError('Você não tem permissão para editar este produto.');
      } else if (error instanceof ApiError && error.status === 404) {
        setEditModalError('Produto não encontrado no backend.');
      } else {
        setEditModalError(getApiErrorMessage(error));
      }
    } finally {
      setIsSyncingStock('');
    }
  };

  const handleDeleteProductFromModal = async () => {
    if (!editingProduct) {
      return;
    }

    const previous = stock.find(item => String(getStockProductId(item)) === editingProduct.productId);
    if (!previous) {
      setEditModalError('Produto nao encontrado para exclusao.');
      return;
    }

    const productId = String(getStockProductId(previous));
    const realProductId = getRealProductId(previous);

    const localDelete = () => {
      setStock(currentStock => currentStock.filter(item => getStockProductId(item) !== productId));
    };

    if (!isValidApiId(realProductId)) {
      localDelete();
      setStockActionError('Produto sem ID real: ação simulada localmente.');
      setImportFeedback(`Produto "${previous.produto}" removido localmente.`);
      setEditingProduct(null);
      setEditModalError('');
      return;
    }

    setIsSyncingStock(`delete-product:${realProductId}`);
    setEditModalError('');

    try {
      await deleteProduct(realProductId);
      localDelete();
      setImportFeedback(`Produto "${previous.produto}" removido.`);
      setEditingProduct(null);
      setEditModalError('');
      setUsingLocalStockFallback(false);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setEditModalError('Você não tem permissão para remover este produto.');
      } else if (error instanceof ApiError && error.status === 404) {
        setEditModalError('Produto não encontrado no backend.');
      } else {
        setEditModalError(getApiErrorMessage(error));
      }
    } finally {
      setIsSyncingStock('');
    }
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
            <button
              type="button"
              onClick={handleImportCsvDisabled}
              className="text-xs px-3 py-2 rounded-md border border-[#2a2a2a] light:border-gray-300 text-gray-300 light:text-gray-700 hover:bg-[#1a1a1a] dark:hover:bg-[#1a1a1a] light:hover:bg-gray-100 transition-colors"
            >
              Importar produtos
            </button>
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

        {showNewProductForm && (
          <div className="px-5 py-4 bg-[#0a0a0a] dark:bg-[#0a0a0a] light:bg-gray-50 border-b border-[#222222] light:border-gray-200">
            <h3 className="text-sm font-semibold !text-white dark:!text-white light:!text-gray-900 mb-3">Cadastrar novo produto</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-400 light:text-gray-600">Nome do produto</label>
                <input
                  type="text"
                  value={newProduct.produto}
                  onChange={event => setNewProduct({ ...newProduct, produto: event.target.value })}
                  placeholder="Ex: Arroz 5kg"
                  className="w-full rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-2 text-xs text-white dark:text-white light:text-gray-900 mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 light:text-gray-600">Estoque mínimo</label>
                <input
                  type="number"
                  value={newProduct.minStockLevel}
                  onChange={event => setNewProduct({ ...newProduct, minStockLevel: event.target.value })}
                  min={0}
                  className="w-full rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-2 text-xs text-white dark:text-white light:text-gray-900 mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 light:text-gray-600">URL da imagem (opcional)</label>
                <input
                  type="url"
                  value={newProduct.imageUrl}
                  onChange={event => setNewProduct({ ...newProduct, imageUrl: event.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-2 text-xs text-white dark:text-white light:text-gray-900 mt-1"
                />
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
                const stockIdentity = item as StockIdentity;
                const available = stockIdentity.availableQuantity ?? Math.max(0, item.total - item.reservado);
                const minStockLevel = getMinStockLevel(item);
                const isLowStock = minStockLevel > 0 && available <= minStockLevel;
                const rowId = getStockProductId(item);
                const rowEdit = editableRows[rowId] ?? { total: String(item.total), reserved: String(item.reservado) };
                const rowSyncKey = `save-row:${String(rowId)}`;

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
                            [rowId]: {
                              total: value,
                              reserved: current[rowId]?.reserved ?? String(item.reservado),
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
                        readOnly
                        className="w-24 rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-100 border border-[#2a2a2a] light:border-gray-300 px-2 py-1 text-xs text-white dark:text-white light:text-gray-700 cursor-not-allowed"
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
                            void handleSaveRow(rowId);
                          }}
                          disabled={isSyncingStock === rowSyncKey}
                          className="text-xs px-2.5 py-1 rounded-md bg-[#00ff66]/15 text-[#00ff66] light:bg-green-100 light:text-green-700 hover:bg-[#00ff66]/25 transition-colors disabled:opacity-60"
                        >
                          Adicionar estoque
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
                      {rowErrors[rowId] && (
                        <p className="mt-1 text-xs text-red-400 light:text-red-700">{rowErrors[rowId]}</p>
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
                <p className="text-sm text-gray-500 light:text-gray-600">Nenhuma movimentação registrada.</p>
              )}

              {filteredMovements.map(movement => (
                <div key={movement.id} className="rounded-lg border border-[#2a2a2a] light:border-gray-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-white dark:text-white light:text-gray-900">Produto: {movement.product}</p>
                    <span className={`text-xs px-2 py-1 rounded-full ${movementTypeClass[movement.type]}`}>
                      {movementTypeLabels[movement.type]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 light:text-gray-600 mt-1">Tipo: {movement.type}</p>
                  <p className="text-xs text-gray-400 light:text-gray-600 mt-1">Quantidade: {movement.quantity}</p>
                  <p className="text-xs text-gray-500 mt-1">Motivo: {movement.source || '-'}</p>
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
                  <label className="text-xs text-gray-400 light:text-gray-600">Nome do produto</label>
                  <input
                    type="text"
                    value={editingProduct.produto}
                    onChange={event => setEditingProduct(current => (current ? { ...current, produto: event.target.value } : null))}
                    className="w-full rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-2 text-xs text-white dark:text-white light:text-gray-900 mt-1"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 light:text-gray-600">Estoque mínimo para alerta</label>
                  <input
                    type="number"
                    min={0}
                    value={editingProduct.minStockLevel}
                    onChange={event => setEditingProduct(current => (current ? { ...current, minStockLevel: event.target.value } : null))}
                    className="w-full rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-2 text-xs text-white dark:text-white light:text-gray-900 mt-1"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-xs text-gray-400 light:text-gray-600">URL da imagem (opcional)</label>
                  <input
                    type="url"
                    value={editingProduct.imageUrl}
                    onChange={event => setEditingProduct(current => (current ? { ...current, imageUrl: event.target.value } : null))}
                    placeholder="https://..."
                    className="w-full rounded-md bg-[#0f0f0f] dark:bg-[#0f0f0f] light:bg-gray-50 border border-[#2a2a2a] light:border-gray-300 px-2 py-2 text-xs text-white dark:text-white light:text-gray-900 mt-1"
                  />
                  {editingProduct.imageUrl && (
                    <img
                      src={editingProduct.imageUrl}
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
