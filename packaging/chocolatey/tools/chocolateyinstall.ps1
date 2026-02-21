$ErrorActionPreference = 'Stop'

$packageName = 'skillet'
$toolsDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$binaryPath = Join-Path $toolsDir 'skillet.exe'
$url64 = 'https://github.com/echohello-dev/skillet/releases/download/v0.0.0/skillet-windows-x64.exe'
$checksum64 = '51cddefde243f0f27e501ca420d5e1d1b9cad548dc9884ea4052d2915afef179'

Get-ChocolateyWebFile -PackageName $packageName -FileFullPath $binaryPath -Url64bit $url64 -Checksum64 $checksum64 -ChecksumType64 'sha256'
Install-BinFile -Name 'skillet' -Path $binaryPath
