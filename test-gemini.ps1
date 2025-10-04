# Test Gemini API
$apiKey = "YOUR_GEMINI_API_KEY_HERE"  # Replace with your actual key
$url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=$apiKey"

$body = @{
    contents = @(
        @{
            parts = @(
                @{
                    text = "Hello, can you help me with genealogy?"
                }
            )
        }
    )
    generationConfig = @{
        maxOutputTokens = 100
        temperature = 0.3
    }
} | ConvertTo-Json -Depth 10

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json"
    Write-Host "Success! Response:"
    $response | ConvertTo-Json -Depth 10
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    Write-Host "Response: $($_.Exception.Response)"
}