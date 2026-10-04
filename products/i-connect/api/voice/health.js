module.exports = (req, res) => {
  res.status(200).json({
    service: 'I-CONNECT Voice Core',
    status: 'READY_FOR_CARRIER_ADAPTER',
    mode: 'control-plane',
    carrierConnected: false,
    timestamp: new Date().toISOString()
  });
};
