Get-ChildItem -Path 'components/atelier/*.tsx' | ForEach-Object {
    $content = Get-Content $_.FullName
    $content = $content -replace '\bIS\b', 'FIS'
    $content = $content -replace 'FISoString', 'toISOString'
    Set-Content -Path $_.FullName -Value $content
}
