param(
    [int]$Port = 8080
)

# Servidor estatico local, sin instalar nada (usa System.Net.HttpListener,
# nativo de PowerShell). Necesario porque abrir index.html con doble-clic
# (file://) bloquea fetch() por CORS - la app SIEMPRE se prueba via
# http://localhost:<puerto>, nunca con doble-clic al archivo.

$root = Split-Path -Parent $PSScriptRoot
$root = (Resolve-Path $root).Path

$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.xlsx' = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.ico'  = 'image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Output "Sirviendo $root en http://localhost:$Port/  (Ctrl+C para detener)"

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        try {
            $urlPath = [System.Uri]::UnescapeDataString($request.Url.AbsolutePath)
            if ($urlPath -eq '/') { $urlPath = '/index.html' }
            $filePath = Join-Path $root ($urlPath.TrimStart('/'))
            $filePath = [System.IO.Path]::GetFullPath($filePath)

            if (-not $filePath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
                $response.StatusCode = 403
                $response.Close()
                continue
            }

            if (Test-Path $filePath -PathType Leaf) {
                $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                $contentType = $mimeTypes[$ext]
                if (-not $contentType) { $contentType = 'application/octet-stream' }
                $response.ContentType = $contentType
                $bytes = [System.IO.File]::ReadAllBytes($filePath)
                $response.ContentLength64 = $bytes.Length
                $response.OutputStream.Write($bytes, 0, $bytes.Length)
            } else {
                $response.StatusCode = 404
                $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes("404 - no encontrado: $urlPath")
                $response.OutputStream.Write($notFoundBytes, 0, $notFoundBytes.Length)
            }
        } catch {
            $response.StatusCode = 500
            Write-Output "Error sirviendo $($request.Url): $($_.Exception.Message)"
        } finally {
            $response.Close()
        }
    }
} finally {
    $listener.Stop()
}
