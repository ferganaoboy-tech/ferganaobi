const os = require('os');
const mongoose = require('mongoose');

// @desc    Get complete system health stats
// @route   GET /api/system/health
// @access  Private (Requires specific password header)
exports.getSystemHealth = async (req, res) => {
  try {
    const password = req.headers['x-monitor-password'];
    // Default password if not set in .env
    const validPassword = process.env.MONITOR_PASSWORD || 'OboiSenior2026';

    if (password !== validPassword) {
      return res.status(401).json({ success: false, message: 'Ruxsat etilmagan! Noto\'g\'ri parol.' });
    }

    // 1. Server Uptime & Process Stats
    const uptimeSeconds = process.uptime();
    
    // 2. Memory Usage (Process)
    const memoryUsage = process.memoryUsage();
    
    // 3. OS Stats
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const loadAvg = os.loadavg(); // [1, 5, 15] minute load averages

    // 4. DB Status
    const dbState = mongoose.connection.readyState; 
    // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
    const dbStatus = dbState === 1 ? 'Connected' : dbState === 2 ? 'Connecting' : 'Disconnected';
    
    let dbStats = null;
    if (dbState === 1) {
      try {
        dbStats = await mongoose.connection.db.stats();
      } catch (err) {
        console.warn('DB Stats xatosi:', err.message);
      }
    }

    // 5. Socket.io Active Connections
    const io = req.app.get('io');
    const activeSockets = io && io.engine ? io.engine.clientsCount : 0;

    res.status(200).json({
      success: true,
      data: {
        server: {
          uptimeSeconds: Math.floor(uptimeSeconds),
          hostname: os.hostname(),
          platform: os.platform(),
          loadAvg: loadAvg.map(n => n.toFixed(2)),
        },
        memory: {
          processRss: Math.round(memoryUsage.rss / 1024 / 1024), // in MB
          processHeap: Math.round(memoryUsage.heapUsed / 1024 / 1024), // in MB
          osTotal: Math.round(totalMemory / 1024 / 1024), // in MB
          osFree: Math.round(freeMemory / 1024 / 1024), // in MB
          osUsagePercent: Math.round(((totalMemory - freeMemory) / totalMemory) * 100),
        },
        database: {
          status: dbStatus,
          objectsCount: dbStats ? dbStats.objects : 0,
          dataSizeMB: dbStats ? (dbStats.dataSize / 1024 / 1024).toFixed(2) : 0,
          storageSizeMB: dbStats ? (dbStats.storageSize / 1024 / 1024).toFixed(2) : 0,
        },
        connections: {
          activeSockets,
        },
        timestamp: new Date()
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get AI diagnostic report based on system health
// @route   GET /api/system/ai-diagnostics
// @access  Private (Requires specific password header)
exports.getSystemAiDiagnostics = async (req, res) => {
  try {
    const password = req.headers['x-monitor-password'];
    const validPassword = process.env.MONITOR_PASSWORD || 'OboiSenior2026';

    if (password !== validPassword) {
      return res.status(401).json({ success: false, message: 'Ruxsat etilmagan! Noto\'g\'ri parol.' });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ success: false, message: 'GROQ_API_KEY is not configured in backend .env' });
    }

    // Yig'ilgan ko'rsatkichlarni tayyorlash
    const uptimeSeconds = process.uptime();
    const memoryUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const loadAvg = os.loadavg().map(n => n.toFixed(2));
    
    const dbState = mongoose.connection.readyState;
    const dbStatus = dbState === 1 ? 'Connected' : dbState === 2 ? 'Connecting' : 'Disconnected';
    
    let dbObjects = 0;
    let dataSizeMB = 0;
    if (dbState === 1) {
      try {
        const dbStats = await mongoose.connection.db.stats();
        dbObjects = dbStats.objects;
        dataSizeMB = (dbStats.dataSize / 1024 / 1024).toFixed(2);
      } catch (err) {}
    }

    const io = req.app.get('io');
    const activeSockets = io && io.engine ? io.engine.clientsCount : 0;

    const processRssMB = Math.round(memoryUsage.rss / 1024 / 1024);
    const osUsagePercent = Math.round(((totalMemory - freeMemory) / totalMemory) * 100);

    const prompt = `Siz katta (Senior) DevOps va Backend dasturchisisiz. Quyida bizning ishlab turgan Node.js serverimiz va tizimning hozirgi jonli ko'rsatkichlari berilgan. Buni chuqur tahlil qiling va mutaxassis sifatida hisobot tayyorlang. O'zbek tilida, toza va professional uslubda yozing.

TIZIM KO'RSATKICHLARI:
- Server Uptime (Ishlayotgan vaqti): ${Math.floor(uptimeSeconds / 3600)} soat, ${Math.floor((uptimeSeconds % 3600) / 60)} daqiqa
- RAM ishlatilishi (Node.js Process): ${processRssMB} MB
- Jami server xotirasi bandligi: ${osUsagePercent}%
- CPU Yuklanishi (Load Average 1m, 5m, 15m): ${loadAvg.join(', ')}
- Jonli foydalanuvchilar (Active Sockets): ${activeSockets} ta
- MongoDB holati: ${dbStatus}
- Ma'lumotlar bazasidagi hujjatlar soni (Objects): ${dbObjects}
- Bazaning haqiqiy hajmi: ${dataSizeMB} MB

Talablar:
1. "Boshqaruv xulosasi" - tizim hozir qanchalik barqaror?
2. "Resurslar tahlili" - RAM va CPU yuklanishi bo'yicha baho bering, xavf bormi?
3. "Ma'lumotlar bazasi va tarmoq" - DB va jonli soketlar sonini hisobga olib qandaydir qiyinchilik (bottleneck) bo'lishi mumkinmi?
4. "Tavsiyalar" - Kelajakda qotib qolmaslik yoki tizimni yanada yaxshilash uchun 2-3 ta texnik tavsiya (faqat ushbu arxitektura va raqamlar bo'yicha).
Javob faqat Markdown formatida chiroyli sarlavhalar va ajratishlar bilan bo'lsin. Hech qanday qo'shimcha salomlashish kerak emas, to'g'ridan to'g'ri xulosaga o'ting.`;

    const fetchRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.6,
      })
    });

    const data = await fetchRes.json();

    if (!fetchRes.ok) {
      throw new Error(data.error?.message || fetchRes.statusText);
    }

    const aiReport = data.choices[0].message.content;

    res.status(200).json({
      success: true,
      data: { report: aiReport }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: `AI diagnostika xatosi: ${error.message}` });
  }
};
