#!/usr/bin/env node
import archy from 'archy'
import chalk from 'chalk'
import rc from 'rc'
import { Buffer } from 'node:buffer'
import querystring from 'node:querystring'
import yargs from 'yargs'
import xl from 'excel4node'
import {hideBin} from 'yargs/helpers'
import dayjs from 'dayjs'

const config = rc('wakamonth', {
    api_key: '',
    employee: 'Jane Doe',
    endpoint: 'https://wakapi.mydomain.org',
    precision: 60,
    project: 'myproject',
    spread_unallocated: true
})

async function fetchSummary(year, month) {
    const monthFirstDay = dayjs().year(year).set('month', month - 1).startOf('month').format('YYYY-MM-DD')
    const monthLastDay = dayjs().year(year).set('month', month - 1).endOf('month').format('YYYY-MM-DD')

    const qs = querystring.encode({
        end: monthLastDay,
        start: monthFirstDay,
        project: config.project,
    })

    const request = new Request(`${config.endpoint}/api/compat/wakatime/v1/users/current/summaries?${qs}`, {
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
    if (res.status === 401) return
    const result = await res.json()
    return result
}


function outputStdout(branches) {   
    const tree = {
        label: 'branches',
        nodes: Object.entries(branches).map(([label, branch]) => {
            return {label: `${chalk.blue(label.padEnd(50))} ${String(branch.total).padStart(5)}h`}
        })
    }

    archy(tree).split('\r').forEach((line) => console.log(line))
}


async function outputExcel(branches, date) {
    const yearFormatted = date.getYear() - 100
    const monthFormatted = date.toLocaleString('default', {month: 'long'})

    const wb = new xl.Workbook()
    const ws = wb.addWorksheet(`Hours ${monthFormatted}-${yearFormatted}`)
    
    const styleTitle = wb.createStyle({font: {bold: true, color: '#000000', size: 12}})
    const styleDefault = wb.createStyle({font: {color: '#000000', size: 12}})
    const styleHours = wb.createStyle({font: {color: '#000000', size: 12}, numberFormat: 'h#,##0.00; (h#,##0.00); -'})
    
    ws.cell(1, 1).string('Branch').style(styleTitle)
    ws.cell(1, 2).string('Hours').style(styleTitle)
    ws.cell(1, 3).string('Include').style(styleTitle)
    ws.column(1).setWidth(60)

    let itemRow = 2
    for (const [branchName, branch] of Object.entries(branches)) {
        const branchHours = branch.total

        ws.cell(itemRow, 1).string(branchName).style(styleDefault)
        ws.cell(itemRow, 2).number(branchHours).style(styleHours)
        ws.cell(itemRow, 3).string('x').style(styleDefault)
        itemRow +=1         
    }

    ws.cell(itemRow, 1).string('Total:').style(styleTitle)
    ws.cell(itemRow, 2).formula(`SUMIF(C2:C${itemRow -1},"x",B2:B${itemRow -1})`)
    
    const filename = `${date.getMonth()}-${date.getYear() - 100}-${config.employee.split(' ').join('-')}.xlsx`
    console.log(`${chalk.blue('wrote excel hours sheet:')} ${filename}`)
    wb.write(`${date.getMonth()}-${date.getYear() - 100}-${config.employee.split(' ').join('-')}.xlsx`)
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
    .option('output', {
        alias: 'o',
        default: 'stdout',
        describe: 'Write hour report to',
        type: 'string',
    })
    .option('year', {
        alias: 'y',
        default: dayjs().format('YYYY'),
        describe: 'The year to report',
        type: 'number',
    })
    .command('report', 'Make an hour report (month)', () => {}, async (argv) => {
        if (!['stdout', 'xlsx'].includes(argv.output)) {
            throw new Error(`Invalid output: ${argv.output}`)
        }
        const branches = {}
        const date = new Date()
        date.setMonth(argv.month - 1)
        date.setFullYear(argv.year)
           
        const result = await fetchSummary(argv.year, argv.month)
        const options = {
            label: 'wakamonth 🕠',
            nodes: [
                {label: `${chalk.cyan('output'.padEnd(50))} ${argv.output.padStart(6)}`},
            ]
        }

        for (const resultSet of result.data) {
            for (const branch of resultSet.branches) {
                if (!(branch.name in branches)) {
                    branches[branch.name] = {total: branch.total_seconds / 60}
                } else {
                    branches[branch.name].total += branch.total_seconds / 60
                }
            }
        }

        if (!Object.keys(branches).length) {
            console.log(`no branches found for ${argv.month}/${argv.year}`)
            return 
        }

        let spreadUnknown = 0
        if (branches.unknown) {
            const unknownHours = (Math.ceil(branches.unknown.total / config.precision) * config.precision) / 60
            const optionUnallocated = {label: chalk.cyan('unallocated'), nodes: []}
            options.nodes.push(optionUnallocated)            
            spreadUnknown = Math.ceil(branches.unknown.total / Object.keys(branches).length)
            optionUnallocated.nodes.push({label: `${chalk.cyan('total'.padEnd(48))} ${String(unknownHours).padStart(5)}h`})
            optionUnallocated.nodes.push({label: `${chalk.cyan('branch'.padEnd(48))} ${String((spreadUnknown / 60).toFixed(2)).padStart(5)}h`})
            optionUnallocated.nodes.push({label: `${chalk.cyan('spread'.padEnd(48))} ${(config.spread_unallocated ? 'yes' : 'no').padStart(6)}`})
            delete branches.unknown
        }

        archy(options).split('\r').forEach((line) => console.log(line))

        for (const branch of Object.values(branches)) {
            if (config.spread_unallocated) { 
                branch.total += spreadUnknown
            }
            branch.total = (Math.ceil(branch.total / config.precision) * config.precision) / 60
        }

        if (argv.output === 'stdout') {
            outputStdout(branches, date)
        } else if (argv.output === 'xlsx') {
            outputExcel(branches, date)
        } 
    })
    .demandCommand(1)
    .parse()
