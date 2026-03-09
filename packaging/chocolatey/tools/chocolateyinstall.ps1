$ErrorActionPreference = 'Stop'

$packageName = 'sklt'
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$binaryPath = Join-Path $toolsDir 'sklt.exe'
$url64 = 'https://github.com/echohello-dev/skillet/releases/download/v0.0.0/sklt-windows-x64.exe'
$checksum64 = 'a47150b22c46e54301a72c44964b4bb7d5437bc1c6d64e397b38ee10eb5f6c4d'

Get-ChocolateyWebFile -PackageName $packageName -FileFullPath $binaryPath -Url64bit $url64 -Checksum64 $checksum64 -ChecksumType64 'sha256'
Install-BinFile -Name 'sklt' -Path $binaryPath
