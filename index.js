import rc from 'rc'
import { Buffer } from 'node:buffer'
import querystring from 'node:querystring'

const config = rc('wakamonth', {
    //defaults go here.
    api_key: '',
    endpoint: '',
})

const qs = querystring.encode({
    from: '2023-10-01',
    project: 'discover',
    to: '2023-10-30'
})

async function fetchSummary() {
    console.log(`${config.endpoint}/api/summary`)
    const request = new Request(`${config.endpoint}/api/summary?${qs}`, {
        method: 'GET',      
        headers: {
            'Accept': 'application/json, text/*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            'Authorization': `Basic ${Buffer.from(config.api_key).toString('base64')}`,
        }
    })

    const res = await fetch(request)
    if (res.status === 401) {
        return
    }
    
    const result = await res.json()
    console.log("RESULT", result.branches.map(branch => `${branch.key},${branch.total}`).join('\n'))
}

await fetchSummary()