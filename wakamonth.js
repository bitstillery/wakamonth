#!/usr/bin/env node
import rc from 'rc'
import { Buffer } from 'node:buffer'
import querystring from 'node:querystring'
import yargs from 'yargs'
import xl from 'excel4node'
import {hideBin} from 'yargs/helpers'
import dayjs from 'dayjs'

const config = rc('wakamonth', {
    //defaults go here.
    api_key: '',
    endpoint: '',
})


async function fetchSummary(month) {
    const month_first_day = dayjs().set('month', month - 1).startOf('month').format('YYYY-MM-DD')
    const month_last_day = dayjs().set('month', month - 1).endOf('month').format('YYYY-MM-DD')

    const qs = querystring.encode({
        from: month_first_day,
        project: 'discover',
        to: month_last_day
    })

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
    return result
}

yargs(hideBin(process.argv))
    .usage('Usage: $0 [task]')
    .detectLocale(false)
    .option('month', {
        alias: 'm',
        default: 1,
        describe: 'Report month number number',
        type: 'number',
    })
    .command('report>', 'Make a month hour report', () => {}, async (argv) => {
        const date = new Date()
        date.setMonth(argv.month - 1)
        const month_formatted = date.toLocaleString('default', {month: 'long'})
        const year_formatted = date.getYear() - 100
        const result = await fetchSummary(argv.month)
        let branches = result.branches.map((branch) => {
            branch.total = Math.ceil(branch.total / 60 / 60)
            return branch
        })
        if (!branches.length) {
            console.log('No branches found')
            return 
        }

        let unknown_branch_index
        const unknown_branch = branches.find((branch, index) => {
            if (branch.key === 'unknown') {
                unknown_branch_index = index
                return true
            }
            return false
        })
        if (unknown_branch) {
            branches.splice(unknown_branch_index, 1)
            const unknown_hours = unknown_branch.total
            const unknown_hour_spread = Math.ceil(unknown_hours / branches.length)
            console.log(`Spreading unallocated time: ${unknown_hours}`)
            branches = branches.map((branch) => {
                branch.total += unknown_hour_spread
                return branch
            })
        }

        const wb = new xl.Workbook()
        const ws = wb.addWorksheet(`Hours ${month_formatted} ${year_formatted}`)
        
        const style_title = wb.createStyle({font: {bold: true, color: '#000000', size: 12}})
        const style_default = wb.createStyle({font: {color: '#000000', size: 12}})
        const style_hours = wb.createStyle({font: {color: '#000000', size: 12}, numberFormat: 'h#,##0.00; (h#,##0.00); -'})
        
        ws.cell(1, 1).string('Branch').style(style_title)
        ws.cell(1, 2).string('Hours').style(style_title)
        ws.cell(1, 3).string('Declarable').style(style_title)
        ws.column(1).setWidth(60)

        let item_row = 2
        for (const branch of branches) {
            const branch_name = branch.key
            const branch_hours = branch.total

            ws.cell(item_row, 1).string(branch_name).style(style_default)
            ws.cell(item_row, 2).number(branch_hours).style(style_hours)
            ws.cell(item_row, 3).string('x').style(style_default)

            item_row +=1 
        }

        ws.cell(item_row, 1).string('Total:').style(style_title)
        ws.cell(item_row, 2).formula(`SUMIF(C2:C${item_row -1},"x",B2:B${item_row -1})`)
        
        wb.write(`hours report ${argv.month}-${year_formatted} ${config.employee}.xlsx`)
    })
    .demandCommand(1)
    .parse()
