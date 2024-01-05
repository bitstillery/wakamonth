# Wakamonth

Generate reports of coding time in hours per Git branch, based on Wakatime/Wakapi activity.
Please notice that time tracked by Wakapi is an **estimate** and definitely not legally binding,
so please keep that in mind when using it for billing reports / invoices.

## Getting started

```bash
wget -O ~/.wakamonthrc https://raw.githubusercontent.com/bitstillery/wakamonth/main/.wakamonthrc.example
npx @bitstillery/wakamonth -y 2024 -m 1 report
```

## Config

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

* api_key: Your Wakatime/Wakapi API key
* domain: The domain to call the endpoint on for [Wakatime](https://wakatime.com) or [Wakapi](https://wakapi.mydomain.org)
* endpoint: [Wakapi](/api/compat/wakatime/v1/users/current/summaries) or [Wakatime](/api/v1/users/current/summaries) endpoint
* precision: 60 (hours) | 30 (half-hourly) | 15 (quarter-hourly)
* project: The Wakatime/Wakapi project to report on
* spread_unallocated: Unknown hours will be spread across other branches if active

## Development

```bash
git clone https://github.com/bitstillery/wakamonth.git
cd wakamonth
pnpm i
./wakamonth.js -y 2024 -m 1 report
```
