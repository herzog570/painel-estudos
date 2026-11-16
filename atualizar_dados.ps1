# Lê os incidencia_*.md da pasta acima de \app e gera app\dados.js (tabelas de incidência das provas).
# Desempenho e semanas NÃO entram: dados pessoais ficam no banco, não no site público.
# Os .md continuam sendo a fonte primária; dados.js pode ser apagado e regerado a qualquer momento.
$ErrorActionPreference = 'Stop'
$app  = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $app

$map = [ordered]@{}
Get-ChildItem -LiteralPath $root -Filter 'incidencia_*.md' -File | Sort-Object Name | ForEach-Object {
    $map[$_.Name] = [System.IO.File]::ReadAllText($_.FullName, [System.Text.Encoding]::UTF8)
}

if ($map.Count -eq 0) { Write-Host "Nenhum .md encontrado em $root" -ForegroundColor Yellow }

$json  = ConvertTo-Json -InputObject $map -Compress
$stamp = Get-Date -Format 'dd/MM/yyyy HH:mm'
$js    = "window.MD_FONTES = $json;`nwindow.MD_GERADO_EM = '$stamp';`n"
[System.IO.File]::WriteAllText((Join-Path $app 'dados.js'), $js, (New-Object System.Text.UTF8Encoding($false)))
Write-Host ("dados.js atualizado com {0} arquivo(s) .md" -f $map.Count) -ForegroundColor Green
