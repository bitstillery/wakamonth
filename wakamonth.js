#!/usr/bin/env node
import rc from 'rc'
import { Buffer } from 'node:buffer'
import querystring from 'node:querystring'
import yargs from 'yargs'
import xl from 'excel4node'
import {hideBin} from 'yargs/helpers'
import dayjs from 'dayjs'

const config = rc('wakamonth', {
    api_key: '',
    employee: '',
    endpoint: '',
    precision: 60,
    project: '',
})

async function fetchSummary(month) {
    const monthFirstDay = dayjs().set('month', month - 1).startOf('month').format('YYYY-MM-DD')
    const monthLastDay = dayjs().set('month', month - 1).endOf('month').format('YYYY-MM-DD')

    const qs = querystring.encode({
        from: monthFirstDay,
        project: config.project,
        to: monthLastDay
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
        const monthFormatted = date.toLocaleString('default', {month: 'long'})
        const yearFormatted = date.getYear() - 100
        const result = await fetchSummary(argv.month)
        const branches = result.branches.map((branch) => {
            // Base granularity is in minutes
            branch.total = branch.total / 60
            return branch
        })
        if (!branches.length) {
            console.log('No branches found')
            return 
        }

        let unknownBranchIndex
        let unknownMinutesSpread = 0
        const unknownBranch = branches.find((branch, index) => {
            if (branch.key === 'unknown') {
                unknownBranchIndex = index
                return true
            }
            return false
        })
        
        if (unknownBranch) {
            branches.splice(unknownBranchIndex, 1)
            const unknownMinutes = unknownBranch.total
            console.log(`unallocated time: ${unknownMinutes}`)
            unknownMinutesSpread = unknownMinutes / branches.length
        }

        branches.forEach((branch) => {
            branch.total += unknownMinutesSpread
            branch.total = (Math.ceil(branch.total / config.precision) * config.precision) / 60
        })

        const wb = new xl.Workbook()
        const ws = wb.addWorksheet(`Hours ${monthFormatted} ${yearFormatted}`)
        
        const styleTitle = wb.createStyle({font: {bold: true, color: '#000000', size: 12}})
        const styleDefault = wb.createStyle({font: {color: '#000000', size: 12}})
        const styleHours = wb.createStyle({font: {color: '#000000', size: 12}, numberFormat: 'h#,##0.00; (h#,##0.00); -'})
        
        ws.cell(1, 1).string('Branch').style(styleTitle)
        ws.cell(1, 2).string('Hours').style(styleTitle)
        ws.cell(1, 3).string('Declarable').style(styleTitle)
        ws.column(1).setWidth(60)

        let itemRow = 2
        for (const branch of branches) {
            const branchName = branch.key
            const branchHours = branch.total

            ws.cell(itemRow, 1).string(branchName).style(styleDefault)
            ws.cell(itemRow, 2).number(branchHours).style(styleHours)
            ws.cell(itemRow, 3).string('x').style(styleDefault)

            itemRow +=1 
            console.log(`${branchName}: ${branchHours}h`)
        }

        ws.cell(itemRow, 1).string('Total:').style(styleTitle)
        ws.cell(itemRow, 2).formula(`SUMIF(C2:C${itemRow -1},"x",B2:B${itemRow -1})`)
        
        wb.write(`${argv.month}-${yearFormatted}-${config.employee.split(' ').join('-')}.xlsx`)
    })
    .demandCommand(1)
    .parse()
