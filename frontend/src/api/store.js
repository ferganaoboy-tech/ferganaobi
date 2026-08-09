// frontend/src/api/store.js
// Temporary mock data store for frontend testing

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const store = {
  warehouses: [
    { _id: 'w1', name: 'Asosiy Sklad', location: 'Toshkent sh., Uchtepa t.', color: '#3b82f6', totalProducts: 10, totalRolls: 500, totalValue: 75000000, lowStockCount: 1 },
    { _id: 'w2', name: 'Optom Sklad', location: 'Toshkent sh., Chilonzor t.', color: '#10b981', totalProducts: 5, totalRolls: 1500, totalValue: 180000000, lowStockCount: 0 },
    { _id: 'w3', name: 'Chakana Magazin', location: 'Toshkent sh., Yunusobod t.', color: '#f59e0b', totalProducts: 15, totalRolls: 200, totalValue: 35000000, lowStockCount: 5 }
  ],
  customers: [
    { _id: 'c1', name: 'Alijon Valiyev', type: 'retail', phone: '+998 90 123 45 67', address: 'Toshkent', totalDebt: 0 },
    { _id: 'c2', name: 'Nodir Usta', type: 'wholesale', phone: '+998 99 987 65 43', address: 'Samarqand', totalDebt: 1500000 },
    { _id: 'c3', name: 'Ideal Oboi MChJ', type: 'wholesale', phone: '+998 71 234 56 78', address: 'Buxoro', totalDebt: 4500000 }
  ],
  products: Array.from({ length: 15 }).map((_, i) => ({
    _id: `p${i+1}`,
    name: `Oboi Milano Classic ${i+1}`,
    artikul: `MIL-00${i+1}`,
    collection: 'Milano',
    warehouse: { _id: `w${(i % 3) + 1}`, name: `Sklad ${(i % 3) + 1}`, color: '#3b82f6' },
    material: i % 2 === 0 ? 'vinyl' : 'flyizelin',
    design: i % 3 === 0 ? 'geometric' : 'floral',
    country: 'Italy',
    width: 1.06,
    rollLength: 10,
    coverage: 10.6,
    color: i % 2 === 0 ? 'Oq' : 'Jigarrang',
    waterproof: true,
    washable: 'yuviladi',
    texture: 'relef',
    rollsPerBox: 6,
    pricePerRoll: 150000 + (i * 10000),
    wholesalePrice: 120000 + (i * 10000),
    quantity: Math.floor(Math.random() * 200) + 5,
    minStock: 20,
    images: []
  })),
  orders: [
    {
      _id: 'o1',
      orderNumber: 'ORD-123456-1',
      customer: { _id: 'c1', name: 'Alijon Valiyev', phone: '+998 90 123 45 67' },
      warehouse: { _id: 'w1', name: 'Asosiy Sklad' },
      type: 'retail',
      items: [
        { product: { _id: 'p1', name: 'Oboi Milano Classic 1', artikul: 'MIL-001' }, quantity: 5, unit: 'rulon', unitPrice: 150000, subtotal: 750000 }
      ],
      totalAmount: 750000, paidAmount: 750000, debtAmount: 0, paymentType: 'naqd', status: 'delivered', createdAt: new Date().toISOString()
    },
    {
      _id: 'o2',
      orderNumber: 'ORD-123457-2',
      customer: { _id: 'c2', name: 'Nodir Usta', phone: '+998 99 987 65 43' },
      warehouse: { _id: 'w2', name: 'Optom Sklad' },
      type: 'wholesale',
      items: [
        { product: { _id: 'p2', name: 'Oboi Milano Classic 2', artikul: 'MIL-002' }, quantity: 20, unit: 'rulon', unitPrice: 120000, subtotal: 2400000 }
      ],
      totalAmount: 2400000, paidAmount: 900000, debtAmount: 1500000, paymentType: 'qisman', status: 'confirmed', createdAt: new Date(Date.now() - 86400000).toISOString()
    }
  ],
  payments: [
    { _id: 'pay1', customer: 'c2', order: 'o2', amount: 900000, method: 'cash', createdAt: new Date().toISOString() }
  ]
};

// Simulate network delay
const delay = (ms = 300) => new Promise(res => setTimeout(res, ms));

export const mockApi = {
  // Products
  fetchProducts: async (params) => {
    await delay();
    let res = [...store.products];
    if (params?.search) {
      res = res.filter(p => (p.brand || '').toLowerCase().includes(params.search.toLowerCase()) || (p.artikul || '').toLowerCase().includes(params.search.toLowerCase()));
    }
    if (params?.lowStock) {
      res = res.filter(p => p.quantity <= p.minStock);
    }
    if (params?.warehouse) {
      res = res.filter(p => p.warehouse._id === params.warehouse);
    }
    return { success: true, data: res, pagination: { total: res.length, page: 1, limit: 100 } };
  },
  fetchProductFilters: async () => {
    await delay(100);
    return { success: true, data: { materials: ['vinyl', 'flyizelin'], designs: ['geometric', 'floral'], countries: ['Italy'], colors: ['Oq', 'Jigarrang'] } };
  },
  fetchDashboardStats: async () => {
    await delay(200);
    const lowStock = store.products.filter(p => p.quantity <= p.minStock);
    return {
      success: true, 
      data: {
        totalProducts: store.products.length,
        totalRolls: store.products.reduce((acc, p) => acc + p.quantity, 0),
        totalValue: store.products.reduce((acc, p) => acc + (p.quantity * p.pricePerRoll), 0),
        lowStockItems: lowStock
      }
    };
  },
  createProduct: async (data) => {
    await delay();
    const newProduct = { _id: generateId(), ...Object.fromEntries(data.entries()), quantity: Number(data.get('quantity')), pricePerRoll: Number(data.get('pricePerRoll')) };
    store.products.unshift(newProduct);
    return { success: true, data: newProduct };
  },
  updateProduct: async ({ id, data }) => {
    await delay();
    return { success: true };
  },
  deleteProduct: async (id) => {
    await delay();
    store.products = store.products.filter(p => p._id !== id);
    return { success: true };
  },

  // Warehouses
  fetchWarehouses: async () => {
    await delay(150);
    return { success: true, data: store.warehouses };
  },

  // Customers
  fetchCustomers: async (params) => {
    await delay();
    let res = [...store.customers];
    if (params?.search) res = res.filter(c => c.name.toLowerCase().includes(params.search.toLowerCase()));
    if (params?.type && params.type !== 'Barchasi') res = res.filter(c => c.type === params.type);
    return { success: true, data: res, pagination: { total: res.length } };
  },
  fetchDebtors: async () => {
    await delay();
    const res = store.customers.filter(c => c.totalDebt > 0);
    return { success: true, data: res };
  },
  createCustomer: async (data) => {
    await delay();
    const c = { _id: generateId(), ...data, totalDebt: 0 };
    store.customers.push(c);
    return { success: true, data: c };
  },
  updateCustomer: async ({ id, data }) => {
    await delay();
    return { success: true };
  },
  deleteCustomer: async (id) => {
    await delay();
    store.customers = store.customers.filter(c => c._id !== id);
    return { success: true };
  },

  // Orders
  fetchOrders: async (params) => {
    await delay();
    let res = [...store.orders];
    if (params?.status && params.status !== 'Barchasi') res = res.filter(o => o.status === params.status);
    if (params?.customer) res = res.filter(o => o.customer._id === params.customer);
    return { success: true, data: res, pagination: { total: res.length } };
  },
  createOrder: async (data) => {
    await delay();
    const o = { _id: generateId(), orderNumber: `ORD-${Date.now().toString().slice(-6)}`, ...data, createdAt: new Date().toISOString() };
    store.orders.unshift(o);
    return { success: true, data: o };
  },
  confirmOrder: async (id) => {
    await delay();
    const o = store.orders.find(x => x._id === id);
    if (o) o.status = 'confirmed';
    return { success: true };
  },
  deliverOrder: async (id) => {
    await delay();
    const o = store.orders.find(x => x._id === id);
    if (o) o.status = 'delivered';
    return { success: true };
  },
  cancelOrder: async (id) => {
    await delay();
    const o = store.orders.find(x => x._id === id);
    if (o) o.status = 'cancelled';
    return { success: true };
  },

  // Payments
  fetchPayments: async (params) => {
    await delay();
    let res = [...store.payments];
    if (params?.customer) res = res.filter(p => p.customer === params.customer);
    return { success: true, data: res };
  },
  createPayment: async (data) => {
    await delay();
    const p = { _id: generateId(), ...data, createdAt: new Date().toISOString() };
    store.payments.unshift(p);
    const c = store.customers.find(c => c._id === data.customer);
    if (c) c.totalDebt = Math.max(0, c.totalDebt - data.amount);
    return { success: true, data: p };
  },

  // Auth (Mock)
  login: async ({ username, password }) => {
    await delay(500); // simulate network
    if (username === 'admin' && password === 'admin123') {
      return { 
        success: true, 
        data: { 
          user: { username: 'admin', name: 'Oboi Admin', role: 'admin' }, 
          token: 'mock-jwt-token-12345' 
        } 
      };
    }
    return { success: false, message: 'Noto\'g\'ri login yoki parol' };
  }
};
