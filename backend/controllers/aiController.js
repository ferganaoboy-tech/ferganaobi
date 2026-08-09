const Product = require('../models/Product');
const Order = require('../models/Order');
const AiReport = require('../models/AiReport');

// Groq API - Free tier, fast, reliable
// Models in priority order
const GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'mixtral-8x7b-32768',
];

exports.getAiAnalytics = async (req, res) => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: 'GROQ_API_KEY is not configured in backend .env'
      });
    }

    // 1. Fetch Products Data (limited projection, max 2000 mahsulot)
    const products = await Product.find({}, 'brand artikul polka quantity pricePerRoll collection minStock isActive')
      .limit(2000)
      .lean();
    
    // Total products available vs out of stock
    const outOfStock = products.filter(p => p.quantity === 0);
    const lowStock   = products.filter(p => p.quantity > 0 && p.quantity <= 20);
    const inStock    = products.filter(p => p.quantity > 20);

    // 2. Fetch Orders Data — so'nggi 90 kun (barcha tarixni olish OOM xavfini tug'diradi)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const orders = await Order.find(
      {
        status: { $ne: 'cancelled' },
        createdAt: { $gte: ninetyDaysAgo },
      },
      'items'
    )
      .populate('items.product', 'brand artikul polka category')
      .lean();
    
    const salesData = {};
    orders.forEach(order => {
      if (order.items) {
        order.items.forEach(item => {
          if (item.product && item.product._id) {
            const prodId = item.product._id.toString();
            if (!salesData[prodId]) {
              salesData[prodId] = {
                name: item.product.brand || item.product.artikul,
                artikul: item.product.artikul,
                totalQuantitySold: 0,
                totalRevenue: 0
              };
            }
            salesData[prodId].totalQuantitySold += item.quantity || 0;
            salesData[prodId].totalRevenue += item.subtotal || ((item.quantity || 0) * (item.unitPrice || 0));
          }
        });
      }
    });

    // Convert salesData to array and sort by quantity sold
    const salesArray = Object.values(salesData).sort((a, b) => b.totalQuantitySold - a.totalQuantitySold);
    const topSellers = salesArray.slice(0, 10);
    
    // Find products with 0 sales
    const productsWithZeroSales = products.filter(p => !salesData[p._id.toString()]);

    // 3. Prepare the Prompt
    const prompt = `Siz O'zbekiston bozori uchun ixtisoslashgan katta biznes-analitik va maslahatchi sifatida faoliyat yuritasiz. Quyidagi devor qog'ozi (oboi) savdo va ombor ma'lumotlarini chuqur tahlil qiling va rahbariyat uchun professional hisobot taqdim eting.

MUHIM KO'RSATMALAR:
1. TILGA OID: Butun hisobotni to'g'ri va ravon O'zbek tilida yozing. Grammatik xatoga yo'l qo'ymang. Gaplar to'liq, mantiqli va mazmunli bo'lsin.
2. SANA: Barcha sana va vaqt ma'lumotlarida 2026-yilni ishlating.
3. VALYUTA: Faqat O'zbek so'mi (so'm) ishlating. Dollar ($) belgisi yoki USD so'zini HECH QACHON ishlatmang.
4. USLUB: Rasmiy va professional biznes tili qo'llang. Fikrlar dalilga asoslangan, lo'nda va aniq bo'lsin.
5. TUZILMA: Javobni AYNAN quyidagi to'rt bo'lim teglari orqali tuzilmalang. Teglardan tashqarida HECH QANDAY matn bo'lmasin.

[SUMMARY]
Boshqaruv xulosasi: Korxonaning hozirgi umumiy holati, asosiy muammolar va topilgan natijalarning qisqa, professional umumiy ko'rinishi. 3-5 jumladan iborat bo'lsin.

[INVENTORY]
Ombor tahlili: Mavjud tovar qoldiqlari holati, tiqilib qolgan mahsulotlar va xavfli nuqtalar haqida aniq tahlil. Har bir fikr ma'lumotlarga asoslangan bo'lsin.

[SALES]
Sotuvlar va talab tahlili: Eng ko'p sotiladigan mahsulotlar, tushum ko'rsatkichlari va xarid qilish naqshlari haqida professional tahlil.

[RECOMMENDATIONS]
Strategik tavsiyalar: Muammolarni hal qilish uchun aniq, amaliy va kutilgan natijalar bilan ifodalangan 3-5 ta tavsiya. Har bir tavsiya mantiqan asoslangan bo'lsin.

Quyida tahlil qilish uchun ma'lumotlar:

=== OMBOR HOLATI ===
- Ombordagi jami mahsulotlar soni: ${products.length} ta
- Yetarli qoldiqdagi mahsulotlar (>20 dona): ${inStock.length} ta
- Kam qolgan mahsulotlar (20 dona va undan kam): ${lowStock.length} ta
- Tugab ketgan mahsulotlar (0 dona): ${outOfStock.length} ta

=== TOP-5 ENG KO'P SOTILGAN MAHSULOTLAR ===
${topSellers.slice(0, 5).map((s, i) => `${i + 1}. ${s.name} (Artikul: ${s.artikul}) - ${s.totalQuantitySold} dona sotilgan, Jami tushum: ${s.totalRevenue.toLocaleString()} so'm`).join('\n')}

=== SOTILMAGAN (TIQILIB QOLGAN) MAHSULOTLAR ===
${productsWithZeroSales.slice(0, 10).map((p, i) => `${i + 1}. ${p.brand || p.artikul} (Artikul: ${p.artikul}) - Qoldiq: ${p.quantity} dona`).join('\n') || "Sotilmagan mahsulot yo'q — bu yaxshi ko'rsatkich!"}

Ushbu ma'lumotlar asosida professional, grammatik jihatdan to'g'ri va mantiqan puxta hisobot tayyorlang.`;


    // 4. Call Groq API with Fallback Chain
    let responseText = null;
    let successfulModel = '';
    let lastError = null;

    for (const model of GROQ_MODELS) {
      try {
        console.log(`AI Analytics: Trying Groq model ${model}...`);

        const fetchRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 2048,
            temperature: 0.7,
          })
        });

        const data = await fetchRes.json();

        if (!fetchRes.ok) {
          throw new Error(data.error?.message || fetchRes.statusText);
        }

        if (data.choices && data.choices.length > 0 && data.choices[0].message?.content) {
          successfulModel = model;
          responseText = data.choices[0].message.content;
          console.log(`AI Analytics: Success with Groq model ${model}`);
          break;
        } else {
          throw new Error('Empty or invalid response from Groq');
        }
      } catch (err) {
        console.warn(`AI Analytics: Groq model ${model} failed:`, err.message);
        lastError = err;
      }
    }

    if (!responseText) {
      throw new Error(`All Groq models failed. Last error: ${lastError ? lastError.message : 'Unknown error'}`);
    }

    const aiReport = responseText;
    
    // Prepare data structures for frontend and DB
    const statsData = {
      totalProducts: products.length,
      outOfStock: outOfStock.length,
      topSellersCount: topSellers.length,
      inStock: inStock.length,
      lowStock: lowStock.length
    };
    
    const chartDataArray = topSellers.map(s => ({
      name: s.name,
      sotilgan_rulon: s.totalQuantitySold,
      tushum: s.totalRevenue
    }));
    
    const inventoryDataArray = [
      { name: 'Sog\'lom Qoldiq', value: inStock.length, color: '#166534' },
      { name: 'Kam Qolgan', value: lowStock.length, color: '#EAB308' },
      { name: 'Tugagan', value: outOfStock.length, color: '#DC2626' }
    ];

    // Save to Database History
    const newReport = new AiReport({
      reportText: aiReport,
      modelUsed: successfulModel,
      stats: statsData,
      chartData: chartDataArray,
      inventoryData: inventoryDataArray
    });
    
    const savedReport = await newReport.save();

    res.status(200).json({
      success: true,
      data: {
        _id: savedReport._id,
        createdAt: savedReport.createdAt,
        report: aiReport,
        modelUsed: successfulModel,
        stats: statsData,
        chartData: chartDataArray,
        inventoryData: inventoryDataArray
      }
    });

  } catch (error) {
    console.error('Error generating AI Analytics:', error);
    res.status(500).json({
      success: false,
      message: `Failed to generate AI analytics: ${error.message}`,
      error: error.stack
    });
  }
};

exports.getAiHistory = async (req, res) => {
  try {
    const history = await AiReport.find({}, '_id createdAt modelUsed stats.totalProducts stats.topSellersCount')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
      
    res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching AI history:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

exports.getAiReportById = async (req, res) => {
  try {
    const report = await AiReport.findById(req.params.id).lean();
    if (!report) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    
    // Format to match frontend structure
    res.status(200).json({
      success: true,
      data: {
        _id: report._id,
        createdAt: report.createdAt,
        report: report.reportText,
        modelUsed: report.modelUsed,
        stats: report.stats,
        chartData: report.chartData,
        inventoryData: report.inventoryData
      }
    });
  } catch (error) {
    console.error('Error fetching AI report:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
