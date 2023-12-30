# Wakamonth

Generate reports of worked hours per Git branch, based on Wakapi activity &amp; branch naming conventions.
That being said, please notice that coding time tracked by Wakapi is only a rough proxy or indicator of the actual amount of work spent on a project / on a feature. It's only an **estimate** and definitely not legally binding, so people should keep that in mind when using it for billing reports / invoices.

## Usage

```bash
git clone https://github.com/bitstillery/wakamonth.git
cd wakamonth
cp .wakamonthrc.example ~/.wakamonthrc
vim ~/.wakamonthrc
pnpm i
./wakamonth.js report -m 12
```

Config:

```json
{
    "api_key": "Your Wakapi API key",
    "endpoint": "https://wakapi.mydomain.org",
    # Used in filename and in Excel sheet
    "employee": "Your name",
    # ceil to minutes; 15 or 30 for quarter- or half-hourly
    "precision": 60, 
    # The Wakapi project to query
    "project": "myproject"
}
```
