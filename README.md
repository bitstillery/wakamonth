# Wakamonth

Generate reports of working time in hours per Git branch, based on your Wakatime/Wakapi activity.
Please notice that time tracked by these tools are an **estimate**; not legally binding,
so make sure to always verify the output of Wakamonth manually when using it for billing
reports / invoices.

## Getting started

A `wakatime.cfg` file is required with `api_key` and `api_url` set. Use like:

```bash
bunx @bitstillery/wakamonth -y 2024 -m 1 -p myproject report
# Export to Excel sheet:
bunx @bitstillery/wakamonth -y 2024 -m 1 -p myproject report -e xlsx
# Target specific user:
bunx @bitstillery/wakamonth -y 2024 -m 1 -p myproject -u myuser report -e xlsx
```

## Config

A Wakamonth config file is not required, unless you want to change its defaults:

```json
{
    "autolink": {
        "enabled": "false",
        "issue_regex": "^\\d+",
        "url": "https://codeberg.org/organisation/{{project}}/issues/{{issue}}"
    },
    "include": {
        "ignore_regex": "^-fix-|main|staging"
    },
    "precision": 30,
    "spread_unallocated": true
}
```

* autolink: automatically links a branch name to an issue in the export
* include.ignore_regex: regex for branch names to exclude from the total count
* precision: 60 (hours) | 30 (half-hourly) | 15 (quarter-hourly)
* spread_unallocated: Unallocated hours will be spread across other branches if active

```bash
wget https://raw.githubusercontent.com/bitstillery/wakamonth/main/.wakamonthrc.example -o ~/.wakamonthrc
vim ~/.wakamonthrc
```

## Development

```bash
git clone https://github.com/bitstillery/wakamonth.git
cd wakamonth
bun install
bun run wakamonth.ts -y 2025 -m 1 -p myproject report -e stdout
```
