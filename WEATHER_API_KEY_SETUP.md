# Weather API key setup

The FastAPI backend reads the Visual Crossing Weather API key from the
`VISUAL_CROSSING_API_KEY` environment variable. Never commit a real
API key in this repository (including `.env` files).

## Important: rotate the exposed key

The old key was committed publicly and must be considered compromised.
In your Visual Crossing account, revoke or rotate that key and issue a new
one. Editing the current GitHub file **does not remove the key from Git history**.
Do not reuse the old key.

## Run locally

In PowerShell (set for the current terminal only):

```powershell
$env:VISUAL_CROSSING_API_KEY = "your-new-key"
uvicorn app.main:app --reload
```

In bash:

```bash
export VISUAL_CROSSING_API_KEY="your-new-key"
uvicorn app.main:app --reload
```

Set the environment variable in the same terminal/session that starts
the backend. Do not paste the real key in GitHub or frontend code.

For deployment, set `VISUAL_CROSSING_API_KEY` as a private environment
variable/secret in the hosting platform's settings, then redeploy.
The React frontend must **not** receive this secret.

If the variable is missing, `POST /slots` returns a 503 error rather
than silently using the old leaked key.

An optional `.env` file is ignored by Git, but this application does
**not** automatically load `.env`. Export the variable in your shell
or configure your deployment environment instead.
