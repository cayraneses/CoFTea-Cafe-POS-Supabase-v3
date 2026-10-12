const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow(){
  const win=new BrowserWindow({width:1500,height:950,minWidth:1100,minHeight:720,backgroundColor:"#f7efe4",icon:path.join(__dirname,"coftea-icon.png"),webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  win.removeMenu();
  win.loadFile(path.join(__dirname,"index.html"));
}
app.whenReady().then(()=>{createWindow();app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow()})});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit()});
