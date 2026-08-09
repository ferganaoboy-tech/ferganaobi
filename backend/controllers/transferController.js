const transferService = require('../services/transferService');

exports.createTransfer = async (req, res) => {
  try {
    const io = req.app.get('io');
    const reqContext = { user: req.user, ip: req.ip || req.connection?.remoteAddress };
    const transfer = await transferService.createTransfer(req.body, req.user, io, reqContext);
    res.status(201).json({ success: true, data: transfer });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getTransfers = async (req, res) => {
  try {
    const result = await transferService.getTransfers(req.query, req.user);
    res.status(200).json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPendingCount = async (req, res) => {
  try {
    const count = await transferService.getPendingCount(req.user);
    res.status(200).json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getTransferById = async (req, res) => {
  try {
    const transfer = await transferService.getTransferById(req.params.id);
    res.status(200).json({ success: true, data: transfer });
  } catch (error) {
    const status = error.message.includes('topilmadi') ? 404 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

exports.acceptTransfer = async (req, res) => {
  try {
    const io = req.app.get('io');
    const reqContext = { user: req.user, ip: req.ip || req.connection?.remoteAddress };
    const transfer = await transferService.acceptTransfer(req.params.id, req.user, io, reqContext);
    res.status(200).json({ success: true, data: transfer });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.rejectTransfer = async (req, res) => {
  try {
    const io = req.app.get('io');
    const reqContext = { user: req.user, ip: req.ip || req.connection?.remoteAddress };
    const transfer = await transferService.rejectTransfer(req.params.id, req.user, io, reqContext);
    res.status(200).json({ success: true, data: transfer });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.cancelTransfer = async (req, res) => {
  try {
    const io = req.app.get('io');
    const reqContext = { user: req.user, ip: req.ip || req.connection?.remoteAddress };
    const transfer = await transferService.cancelTransfer(req.params.id, req.user, io, reqContext);
    res.status(200).json({ success: true, data: transfer });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.createTransferRequest = async (req, res) => {
  try {
    const io = req.app.get('io');
    const reqContext = { user: req.user, ip: req.ip || req.connection?.remoteAddress };
    const transfer = await transferService.createTransferRequest(req.body, req.user, io, reqContext);
    res.status(201).json({ success: true, data: transfer });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.approveTransferRequest = async (req, res) => {
  try {
    const io = req.app.get('io');
    const reqContext = { user: req.user, ip: req.ip || req.connection?.remoteAddress };
    const transfer = await transferService.approveTransferRequest(req.params.id, req.user, io, reqContext);
    res.status(200).json({ success: true, data: transfer });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.rejectTransferRequest = async (req, res) => {
  try {
    const io = req.app.get('io');
    const reqContext = { user: req.user, ip: req.ip || req.connection?.remoteAddress };
    const transfer = await transferService.rejectTransferRequest(req.params.id, req.user, io, reqContext);
    res.status(200).json({ success: true, data: transfer });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
