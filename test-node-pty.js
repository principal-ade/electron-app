const { app } = require('electron');

app.whenReady().then(() => {
  try {
    const pty = require('node-pty');
    console.log('✅ node-pty loaded successfully in Electron');
    console.log('Available properties:', Object.keys(pty));
  } catch (error) {
    console.error('❌ Failed to load node-pty:', error.message);
    console.error('Stack:', error.stack);
  }
  app.quit();
});

app.on('window-all-closed', () => {
  app.quit();
});