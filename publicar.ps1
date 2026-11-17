# Publica o painel no GitHub Pages: gera dados.js a partir dos .md e envia a pasta app\ para o repositório.
# Pré-requisito: Git para Windows instalado. No primeiro envio o Git abre o login do GitHub no navegador.
$ErrorActionPreference = 'Stop'
$app = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = 'https://github.com/herzog570/painel-estudos.git'

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $app 'atualizar_dados.ps1')
Set-Location $app

# Nome diferente de 'git': no PowerShell nomes não diferenciam maiúsculas, e uma função 'Git' chamaria a si mesma
function Invoke-Git { & git.exe @args; if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') falhou (código $LASTEXITCODE)" } }

if (-not (Test-Path (Join-Path $app '.git'))) { Invoke-Git init -q -b main }
if (-not (git.exe remote 2>$null | Select-String -Quiet '^origin$')) { Invoke-Git remote add origin $repo }

# Identidade do autor dos commits (só deste repositório), se ainda não houver uma global
if (-not (git.exe config user.name))  { Invoke-Git config user.name  'herzog570' }
if (-not (git.exe config user.email)) { Invoke-Git config user.email 'herzog570@users.noreply.github.com' }

# Acompanha o que já está no GitHub (inclui envios feitos de outro lugar) sem mexer nos arquivos da pasta
git.exe fetch -q origin main 2>$null
if ($LASTEXITCODE -eq 0) { Invoke-Git reset -q --soft origin/main }

Invoke-Git add -A
if (-not (git.exe status --porcelain)) { Write-Host "Nada a publicar: nenhuma mudança desde o último envio." -ForegroundColor Yellow; exit 0 }
Invoke-Git commit -q -m ("Atualiza painel " + (Get-Date -Format 'dd/MM/yyyy HH:mm'))
Invoke-Git push -u origin main
Write-Host "Publicado. Em ~1 min: https://herzog570.github.io/painel-estudos/" -ForegroundColor Green
