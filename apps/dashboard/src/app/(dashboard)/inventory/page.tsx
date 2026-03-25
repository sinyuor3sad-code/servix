'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'motion/react';
import {
  Package,
  Plus,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  Trash2,
  Search,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { dashboardService } from '@/services/dashboard.service';
import {
  PageHeader,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Button,
  Badge,
  Input,
  Skeleton,
  EmptyState,
} from '@/components/ui';
import type { Product, InventoryMovement } from '@/types';

const movementTypes: Record<string, { label: string; color: string }> = {
  purchase: { label: 'شراء', color: 'success' },
  consumption: { label: 'استهلاك', color: 'warning' },
  adjustment: { label: 'تعديل', color: 'secondary' },
  waste: { label: 'هدر', color: 'destructive' },
};

function formatCurrency(value: number): string {
  return `${value.toLocaleString('ar-SA')} ر.س`;
}

function StockIndicator({ product }: { product: Product }) {
  const ratio = product.minStock > 0 ? product.currentStock / product.minStock : 999;
  const isLow = ratio < 1;
  const isCritical = ratio < 0.5;

  return (
    <div className="flex items-center gap-2">
      <span className={`text-sm font-bold ${isCritical ? 'text-red-500' : isLow ? 'text-amber-500' : 'text-emerald-500'}`}>
        {product.currentStock}
      </span>
      <span className="text-xs text-[var(--muted-foreground)]">/ {product.minStock}</span>
      {isLow && (
        <AlertTriangle className={`h-4 w-4 ${isCritical ? 'text-red-500' : 'text-amber-500'}`} />
      )}
    </div>
  );
}

export default function InventoryPage(): React.ReactElement {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProduct, setNewProduct] = useState({ nameAr: '', sku: '', costPrice: '', minStock: '', categoryId: '' });
  const [movementForm, setMovementForm] = useState<{ productId: string; type: string; quantity: string; note: string } | null>(null);

  const { data: products, isLoading } = useQuery({
    queryKey: ['inventory', 'products'],
    queryFn: () => dashboardService.getProducts(accessToken!),
    enabled: !!accessToken,
  });

  const { data: lowStock } = useQuery({
    queryKey: ['inventory', 'low-stock'],
    queryFn: () => dashboardService.getLowStock(accessToken!),
    enabled: !!accessToken,
  });

  const { data: categories } = useQuery({
    queryKey: ['inventory', 'categories'],
    queryFn: () => dashboardService.getProductCategories(accessToken!),
    enabled: !!accessToken,
  });

  const createMutation = useMutation({
    mutationFn: (data: Partial<Product>) => dashboardService.createProduct(data, accessToken!),
    onSuccess: () => {
      toast.success('تمت إضافة المنتج');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setShowAddForm(false);
      setNewProduct({ nameAr: '', sku: '', costPrice: '', minStock: '', categoryId: '' });
    },
    onError: () => toast.error('فشل إضافة المنتج'),
  });

  const movementMutation = useMutation({
    mutationFn: ({ productId, ...data }: { productId: string; type: string; quantity: number; note: string }) =>
      dashboardService.recordMovement(productId, data as Partial<InventoryMovement>, accessToken!),
    onSuccess: () => {
      toast.success('تم تسجيل الحركة');
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setMovementForm(null);
    },
    onError: () => toast.error('فشل تسجيل الحركة'),
  });

  const filteredProducts = (products ?? []).filter((p) =>
    search ? p.nameAr.includes(search) || (p.sku?.includes(search) ?? false) : true,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="المخزون"
        description="إدارة المنتجات والمواد وتتبع المخزون"
        actions={
          <Button onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 me-2" />
            إضافة منتج
          </Button>
        }
      />

      {/* Low Stock Alert */}
      {lowStock && lowStock.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <p className="font-medium text-amber-800">تنبيه مخزون منخفض</p>
                  <p className="text-sm text-amber-600">
                    {lowStock.length} منتج تحت الحد الأدنى: {lowStock.slice(0, 3).map(p => p.nameAr).join('، ')}
                    {lowStock.length > 3 && ` و${lowStock.length - 3} آخرين`}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Add Product Form */}
      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>إضافة منتج جديد</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input placeholder="اسم المنتج *" value={newProduct.nameAr} onChange={(e) => setNewProduct(p => ({ ...p, nameAr: e.target.value }))} />
              <Input placeholder="SKU" value={newProduct.sku} onChange={(e) => setNewProduct(p => ({ ...p, sku: e.target.value }))} />
              <Input type="number" placeholder="سعر التكلفة *" value={newProduct.costPrice} onChange={(e) => setNewProduct(p => ({ ...p, costPrice: e.target.value }))} />
              <Input type="number" placeholder="الحد الأدنى" value={newProduct.minStock} onChange={(e) => setNewProduct(p => ({ ...p, minStock: e.target.value }))} />
            </div>
            {categories && categories.length > 0 && (
              <select
                className="mt-4 w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm"
                value={newProduct.categoryId}
                onChange={(e) => setNewProduct(p => ({ ...p, categoryId: e.target.value }))}
              >
                <option value="">اختر الفئة</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.nameAr}</option>
                ))}
              </select>
            )}
            <div className="flex gap-2 mt-4">
              <Button
                disabled={!newProduct.nameAr || !newProduct.costPrice || createMutation.isPending}
                onClick={() => createMutation.mutate({
                  nameAr: newProduct.nameAr,
                  sku: newProduct.sku || undefined,
                  costPrice: parseFloat(newProduct.costPrice),
                  minStock: parseInt(newProduct.minStock) || 0,
                  categoryId: newProduct.categoryId || undefined,
                } as Partial<Product>)}
              >
                حفظ
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Movement Form */}
      {movementForm && (
        <Card>
          <CardHeader>
            <CardTitle>تسجيل حركة مخزون</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <select
                className="rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 text-sm"
                value={movementForm.type}
                onChange={(e) => setMovementForm(f => f && ({ ...f, type: e.target.value }))}
              >
                {Object.entries(movementTypes).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <Input type="number" placeholder="الكمية *" value={movementForm.quantity} onChange={(e) => setMovementForm(f => f && ({ ...f, quantity: e.target.value }))} />
              <Input placeholder="ملاحظة" value={movementForm.note} onChange={(e) => setMovementForm(f => f && ({ ...f, note: e.target.value }))} />
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                disabled={!movementForm.quantity || movementMutation.isPending}
                onClick={() => movementMutation.mutate({
                  productId: movementForm.productId,
                  type: movementForm.type,
                  quantity: parseFloat(movementForm.quantity),
                  note: movementForm.note,
                })}
              >
                تسجيل
              </Button>
              <Button variant="outline" onClick={() => setMovementForm(null)}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث عن منتج..."
          className="ps-10"
        />
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : filteredProducts.length === 0 ? (
        <EmptyState
          icon={Package}
          title="لا توجد منتجات"
          description="أضف أول منتج لبدء تتبع المخزون"
          actionLabel="إضافة منتج"
          onAction={() => setShowAddForm(true)}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProducts.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-[var(--foreground)]">{product.nameAr}</h3>
                      {product.sku && <p className="text-xs text-[var(--muted-foreground)]">SKU: {product.sku}</p>}
                    </div>
                    <Badge variant={product.isActive ? 'success' : 'secondary'}>
                      {product.isActive ? 'نشط' : 'معطل'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-[var(--muted-foreground)]">المخزون</span>
                    <StockIndicator product={product} />
                  </div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-[var(--muted-foreground)]">التكلفة</span>
                    <span className="text-sm font-medium">{formatCurrency(product.costPrice)}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setMovementForm({ productId: product.id, type: 'purchase', quantity: '', note: '' })}
                    >
                      <ArrowUpCircle className="h-3.5 w-3.5 me-1" />
                      إضافة
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setMovementForm({ productId: product.id, type: 'consumption', quantity: '', note: '' })}
                    >
                      <ArrowDownCircle className="h-3.5 w-3.5 me-1" />
                      صرف
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
