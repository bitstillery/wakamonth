#!/usr/bin/env node
import archy from 'archy'
import chalk from 'chalk'
import rc from 'rc'
import {Buffer} from 'node:buffer'
import fs from 'fs'
import path from 'path'
import os from 'os'
import querystring from 'node:querystring'
import yargs from 'yargs'
import xl from 'excel4node'
import ini from 'ini'
import {hideBin} from 'yargs/helpers'
import dayjs from 'dayjs'

const wakatime_path = path.join(os.homedir(), '.wakatime.cfg')

if (!fs.existsSync(wakatime_path)) {
    console.error('a ~/.wakatime.cfg file is required')
    process.exit(1)
}

const wakatime_config = ini.parse(fs.readFileSync(wakatime_path, 'utf8'))
const config = rc('wakamonth', {
    api_url: wakatime_config.settings.api_url,
    api_key: wakatime_config.settings.api_key,
    precision: 60,
    spread_unallocated: true
})

async function fetchSummary(project, user, year, month) {
    const monthFirstDay = dayjs().year(year).set('month', month - 1).startOf('month').format('YYYY-MM-DD')
    const monthLastDay = dayjs().year(year).set('month', month - 1).endOf('month').format('YYYY-MM-DD')

    const qs = querystring.encode({
        end: monthLastDay,
        start: monthFirstDay,
        project,
    })

    const endpoint = `/v1/users/${user.id}/summaries`
    const request = new Request(`${config.api_url}${endpoint}?${qs}`, {
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

async function fetchUser(user) {
    const endpoint = `/v1/users/${user}`
    const request = new Request(`${config.api_url}${endpoint}`, {
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
    const result = await res.json()
    return result.data
}

async function outputExcel(user, branches, date) {
    const ymd = date.toISOString().split('T')[0].split('-')

    const wb = new xl.Workbook()
    const ws = wb.addWorksheet(`Hours ${ymd[0]}-${ymd[1]}`)
    
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
    
    const filename = `${ymd[0]}-${ymd[1]}-${user.username}.xlsx`
    wb.write(filename)
    console.log(`${chalk.green('excel export:')} ${filename}`)
}

yargs(hideBin(process.argv))
    .usage('Usage: $0 [task]')
    .detectLocale(false)
    .option('month', {
        alias: 'm',
        default: new Date().getMonth() + 1,
        describe: 'Report month number number',
        type: 'number',
    })
    .option('user', {
        alias: 'u',
        default: 'current',
        describe: 'User to report on',
        type: 'string',
    })
    .option('export', {
        alias: 'e',
        default: '',
        describe: 'Export to',
        type: 'string',
    })
    .option('project', {
        alias: 'p',
        default: '',
        describe: 'Project to filter on',
        type: 'string',
    })
    .option('year', {
        alias: 'y',
        default: dayjs().format('YYYY'),
        describe: 'Year to report on',
        type: 'number',
    })
    .command('report', 'Make an hour report (month)', () => {}, async (argv) => {
        if (argv.export && !['xlsx'].includes(argv.export)) {
            throw new Error(`Invalid output: ${argv.export}`)
        }
        const branches = {}
        let allocatedHours = 0
        const date = new Date()
        date.setMonth(argv.month - 1)
        date.setFullYear(argv.year)
        const user = await fetchUser(argv.user)
        const result = await fetchSummary(argv.project, user, argv.year, argv.month)
        const options = {
            label: 'wakamonth 🕠',
            nodes: []
        }

        if (!result) {
            console.log(`No results found for ${argv.project}/${user.id}-${argv.year}/${argv.month}`)
            process.exit(1)
        }

        for (const resultSet of result.data) {   
            // No rounding; just keep the Wakapi numbers here in minutes.
            for (const branch of resultSet.branches) {
                const total = branch.total_seconds / 60
                if (!(branch.name in branches)) {
                    branches[branch.name] = {total}
                } else {
                    branches[branch.name].total += total
                }                
            }            
        }

        if (!Object.keys(branches).length) {
            console.log(`no branches found for project ${argv.project}:${argv.month}/${argv.year}`)
            return
        }

        let spreadUnknown = 0


        allocatedHours
        const optionUnallocated = {label: chalk.yellow('unallocated'), nodes: []}  
        if (branches.unknown) {
            const unAllocatedHours = (Math.ceil(branches.unknown.total / config.precision) * config.precision) / 60                              
            spreadUnknown = Math.ceil(branches.unknown.total / Object.keys(branches).length)
            optionUnallocated.nodes.push({label: `${chalk.white('total'.padEnd(48))} ${String(unAllocatedHours).padStart(5)}h`})
            optionUnallocated.nodes.push({label: `${chalk.white('spread'.padEnd(48))} ${(config.spread_unallocated ? 'yes' : 'no').padStart(6)}`})
            optionUnallocated.nodes.push({label: `${chalk.white('time / branch'.padEnd(48))} ${String((spreadUnknown / 60).toFixed(2)).padStart(5)}h`})
            delete branches.unknown
        }
       
        for (const branch of Object.values(branches)) {
            // Rounding; assign unallocated hours (if applicable).
            if (config.spread_unallocated) { 
                branch.total += spreadUnknown
            }
            branch.total = (Math.ceil(branch.total / config.precision) * config.precision) / 60
            allocatedHours += branch.total
        }

        const optionAllocated = {label: chalk.green('allocated'), nodes: []}
        optionAllocated.nodes.push({label: `${chalk.white('total'.padEnd(48))} ${String(allocatedHours).padStart(5)}h`})
        options.nodes.push({
            label: 'branches',
            nodes: Object.entries(branches).map(([label, branch]) => {
                return {label: `${chalk.blue(label.padEnd(50))} ${String(branch.total).padStart(5)}h`}
            })
        })
        options.nodes.push(optionUnallocated) 
        options.nodes.push(optionAllocated)
        archy(options).split('\r').forEach((line) => console.log(line))

        if (argv.export === 'xlsx') {
            outputExcel(user, branches, date)
        } 
    })
    .demandCommand(1)
    .parse()
