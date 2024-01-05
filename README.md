# Wakamonth

Generate reports of coding time in hours per Git branch, based on Wakatime/Wakapi activity.
Please notice that time tracked by Wakapi is an **estimate** and definitely not legally binding,
so please keep that in mind when using it for billing reports / invoices.

## Configuration

```bash
wget https://raw.githubusercontent.com/bitstillery/wakamonth/main/.wakamonthrc.example -o ~/.wakamonthrc
vim ~/.wakamonthrc
```

```json
{
    "api_key": "Your Wakapi API key",
    "domain": "https://wakapi.mydomain.org",
    "endpoint": "/api/compat/wakatime/v1/users/current/summaries",
    "employee": "Your name",
    "precision": 60, 
    "project": "myproject",
    "spread_unallocated": true
}
```

Config explanation:

```md
api_key:
Your Wakatime/Wakapi API key

domain:
The domain to call the endpoint on
"https://wakatime.com" for Wakatime
"https://wakapi.mydomain.org" for Wakapi

endpoint:
"/api/compat/wakatime/v1/users/current/summaries" for Wakapi
"/api/v1/users/current/summaries" for Wakatime

precision:
Ceils branch time to minutes
- 60 for hours
- 30 for half-hourly
- 15 for quarter-hourly

project:
The Wakatime/Wakapi project to report on

spread_unallocated:
Unknown hours will be spread across other branches if active
```

## Usage

Typical usage:

```bash
npx @bitstillery/wakamonth -y 2024 -m 1 report
```

For development:

```bash
git clone https://github.com/bitstillery/wakamonth.git
cd wakamonth
pnpm i
./wakamonth.js -y 2024 -m 1 report
```
