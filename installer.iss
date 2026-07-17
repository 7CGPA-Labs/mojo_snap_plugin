[Setup]
AppName=Mojo Snap Console (Jellyfin Plugin)
AppVersion=0.1.0
AppPublisher=7CGPA-Labs
AppPublisherURL=https://github.com/7CGPA-Labs/mojo_snap_plugin
DefaultDirName={pf}\Jellyfin\Server
DisableDirPage=yes
DefaultGroupName=Mojo Snap Console
DisableProgramGroupPage=yes
OutputBaseFilename=MojoSnap_Setup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
OutputDir=dist

[Files]
; Server Plugin Assembly
Source: "dist\MojoSnapPlugin.dll"; DestDir: "{code:GetDataFolder}\plugins\MojoSnapPlugin"; Flags: ignoreversion

; Frontend Web Assets
Source: "src\Web\*"; DestDir: "{code:GetInstallFolder}\jellyfin-web\mojosnap"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "shared\*"; DestDir: "{code:GetInstallFolder}\jellyfin-web\mojosnap\shared"; Flags: ignoreversion recursesubdirs createallsubdirs

[Code]
function GetInstallFolder(Param: String): String;
var
  InstallPath: String;
begin
  // Try 64-bit registry first
  if RegQueryStringValue(HKLM64, 'SOFTWARE\Jellyfin\Server', 'InstallFolder', InstallPath) then begin
    Result := InstallPath;
    Exit;
  end;
  // Try 32-bit registry
  if RegQueryStringValue(HKLM32, 'SOFTWARE\Jellyfin\Server', 'InstallFolder', InstallPath) then begin
    Result := InstallPath;
    Exit;
  end;
  // Fallback
  Result := ExpandConstant('{pf}\Jellyfin\Server');
end;

function GetDataFolder(Param: String): String;
var
  DataPath: String;
begin
  // Try 64-bit registry first
  if RegQueryStringValue(HKLM64, 'SOFTWARE\Jellyfin\Server', 'DataFolder', DataPath) then begin
    Result := DataPath;
    Exit;
  end;
  // Try 32-bit registry
  if RegQueryStringValue(HKLM32, 'SOFTWARE\Jellyfin\Server', 'DataFolder', DataPath) then begin
    Result := DataPath;
    Exit;
  end;
  // Fallback
  Result := ExpandConstant('{commonappdata}\Jellyfin\Server');
end;

[Run]
Filename: "sc.exe"; Parameters: "restart jellyfin"; Flags: runhidden; StatusMsg: "Restarting Jellyfin Server (if running as a service)..."
