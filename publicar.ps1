# Publica o painel no GitHub Pages: gera dados.js a partir dos .md e envia a pasta app\ para o repositório.
# Pré-requisito: Git para Windows instalado. No primeiro envio o Git abre o login do GitHub no navegador.
$ErrorActionPreference = 'Stop'
$app = Split-Path -Parent $MyInvocation.MyCommand.Path
$repo = 'https://github.com/herzog570/painel-estudos.git'

& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $app 'atualizar_dados.ps1')
Set-Location $app

function Git { git @args; if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') falhou (código $LASTEXITCODE)" } }

if (-not (Test-Path (Join-Path $app '.git'))) { Git init -q -b main }
if (-not (git remote 2>$null | Select-String -Quiet '^origin$')) { Git remote add origin $repo }

# Identidade do autor dos commits (só deste repositório), se ainda não houver uma global
if (-not (git config user.name))  { Git config user.name  'herzog570' }
if (-not (git config user.email)) { Git config user.email 'herzog570@users.noreply.github.com' }

# Acompanha o que já está no GitHub (inclui envios feitos de outro lugar) sem mexer nos arquivos da pasta
git fetch -q origin main 2>$null
if ($LASTEXITCODE -eq 0) { Git reset -q --soft origin/main }

Git add -A
if (-not (git status --porcelain)) { Write-Host "Nada a publicar: nenhuma mudança desde o último envio." -ForegroundColor Yellow; exit 0 }
Git commit -q -m ("Atualiza painel " + (Get-Date -Format 'dd/MM/yyyy HH:mm'))
Git push -u origin main
Write-Host "Publicado. Em ~1 min: https://herzog570.github.io/painel-estudos/" -ForegroundColor Green
