# Wakamonth

Generate reports of coding time in hours per Git branch, based on Wakatime/Wakapi activity.
Please notice that time tracked by Wakapi is an **estimate**; not legally binding,
so please keep that in mind when using it for billing reports / invoices.

## Getting started

A `wakatime.cfg` file is required with `api_key` and `api_url` set. Use like:

```bash
npx @bitstillery/wakamonth -y 2024 -m 1 -p myproject report
# Export to Excel sheet:
npx @bitstillery/wakamonth -y 2024 -m 1 -p myproject report -e xlsx
# Target specific user:
npx @bitstillery/wakamonth -y 2024 -m 1 -p myproject -u myuser report -e xlsx
```

## Config

A Wakamonth config file is not required, unless you want to change its defaults:

```json
{
    "backend": "wakapi",
    "spread_unallocated": true,
    "precision": 60,
}
```

* backend: "wakapi" or "wakatime"
* precision: 60 (hours) | 30 (half-hourly) | 15 (quarter-hourly)
* spread_unallocated: Unknown hours will be spread across other branches if active

```bash
wget https://raw.githubusercontent.com/bitstillery/wakamonth/main/.wakamonthrc.example -o ~/.wakamonthrc
vim ~/.wakamonthrc
```

## Development

```bash
git clone https://github.com/bitstillery/wakamonth.git
cd wakamonth
pnpm i
./wakamonth.js -y 2024 -m 1 -p myproject report -e stdout
```
