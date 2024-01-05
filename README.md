# Wakamonth

Generate reports of worked hours per Git branch, based on Wakapi activity &amp; branch naming conventions.
That being said, please notice that coding time tracked by Wakapi is only a rough proxy or indicator of the actual
amount of work spent on a project / on a feature. It's only an **estimate** and definitely not legally binding,
so people should keep that in mind when using it for billing reports / invoices.

## Config

```bash
wget https://raw.githubusercontent.com/bitstillery/wakamonth/main/.wakamonthrc.example -o .wakamonthrc
vim ~/.wakamonthrc
```

```json
{
    "api_key": "Your Wakapi API key",
    "endpoint": "https://wakapi.mydomain.org",
    "employee": "Your name",
    "precision": 60, 
    "project": "myproject"
}
```

Config explanation:

```md
api_key: Your Wakatime/Wakapi API key
endpoint: The domain to call the endpoint on
employee: Shows this name in the Excel export
precion: Ceil to minutes; 60 for hours, 30 for half-hourly or 15 for quarter-hourly
project: The Wakatime/Wakapi project to report on
spread_unallocated: Unknown hours will be spread between other branches if active
```

## Usage

Typical usage:

```bash
npx wakamonth -y 2024 -m 1 report -o stdout
```

For development:

```bash
git clone https://github.com/bitstillery/wakamonth.git
cd wakamonth
pnpm i
./wakamonth.js -y 2024 -m 1 report
```
