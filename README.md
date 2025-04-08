# Example of using api some DEX and CEX

# Install dependencies
```
npm ci
```

# Run tests
```bash 
npx jest --verbose  
```
run only test
```bash
npx jest exchanges -t "<name>"
```

# Mock Requests

use https://github.com/jefflau/jest-fetch-mock in setup.ts