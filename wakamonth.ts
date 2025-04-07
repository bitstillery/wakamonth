#!/usr/bin/env bun
import {Buffer} from 'node:buffer'
import archy from 'archy'
import dayjs from 'dayjs'
import fs from 'fs'
import {hideBin} from 'yargs/helpers'
import ini from 'ini'
import os from 'os'
import path from 'path'
import pc from 'picocolors'
import querystring from 'node:querystring'
import rc from 'rc'
import xl from 'excel4node'
import yargs from 'yargs'

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
    spread_unallocated: true,
})

interface Branch {
    total: number
}

interface Branches {
    [branchName: string]: Branch
}

interface DayResult {
    day: string
    data: any
    branches: Branches
}

interface DayResults {
    [day: string]: DayResult
}

async function fetchSummary(project, user, year, month): Promise<DayResults> {
    let monthDay = dayjs().year(year).set('month', month - 1).startOf('month').format('YYYY-MM-DD')

    const monthLastDay = dayjs().year(year).set('month', month - 1).endOf('month').format('YYYY-MM-DD')
    const endpoint = config.backend === 'wakapi' ? `/compat/wakatime/v1/users/${user.id}/summaries` : `/v1/users/${user.id}/summaries`
    let dayResults: DayResults = {}

    while (monthDay <= monthLastDay) {
        const qs = querystring.encode({end: monthDay, start: monthDay, project})
        const request = new Request(`${config.api_url}${endpoint}?${qs}`, {
            method: 'GET',
            headers: {
                Accept: 'application/json, text/*',
                'Accept-Encoding': 'gzip, deflate, br',
                'Content-Type': 'application/json; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                Authorization: `Basic ${Buffer.from(config.api_key).toString('base64')}`,
            },
        })

        const res = await fetch(request)
        if (res.status === 401) return
        const result = await res.json()
        dayResults[monthDay] = {
            branches: {...result.data.branches,
                'bar': {total: 40},
                'foo': {total: 70},
            },
            day: monthDay,
            data: result.data,
        }
        monthDay = dayjs(monthDay).add(1, 'day').format('YYYY-MM-DD')
    }

    return dayResults
}

async function fetchUser(user) {
    const endpoint = config.backend === 'wakapi' ? `/compat/wakatime/v1/users/${user}` : `/v1/users/${user}`
    const request = new Request(`${config.api_url}${endpoint}`, {
        method: 'GET',
        headers: {
            Accept: 'application/json, text/*',
            'Accept-Encoding': 'gzip, deflate, br',
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Requested-With': 'XMLHttpRequest',
            Authorization: `Basic ${Buffer.from(config.api_key).toString('base64')}`,
        },
    })
    const res = await fetch(request)
    const result = await res.json()
    return result.data
}

async function outputExcel(user, project, dayResults: DayResults, date, argv) {
    const ymd = date.toISOString().split('T')[0].split('-')

    const wb = new xl.Workbook()
    const ws = wb.addWorksheet(`Hours ${project}: ${ymd[0]}-${ymd[1]}`)

    const styleDefault = wb.createStyle({font: {color: '#000000', size: 12}})
    const styleHours = wb.createStyle({font: {color: '#000000', size: 12}, numberFormat: 'h#,##0.00; (h#,##0.00); -'})

    // Enhanced header style
    const styleHeader = wb.createStyle({
        font: {
            bold: true,
            color: '#000000',
            size: 12
        },
        alignment: {
            horizontal: 'center',
            vertical: 'center',
            wrapText: true
        },
        fill: {
            type: 'pattern',
            patternType: 'solid',
            fgColor: '#E0E0E0'  // Light gray background
        },
        border: {
            left: {
                style: 'thin',
                color: '#000000'
            },
            right: {
                style: 'thin',
                color: '#000000'
            },
            top: {
                style: 'thin',
                color: '#000000'
            },
            bottom: {
                style: 'thin',
                color: '#000000'
            }
        }
    })

    // Near the top with other styles, add a new style for totals row
    const styleTotalRow = wb.createStyle({
        font: {
            bold: true,
            color: '#000000',
            size: 12
        },
        alignment: {
            horizontal: 'center',
            vertical: 'center'
        },
        fill: {
            type: 'pattern',
            patternType: 'solid',
            fgColor: '#C0C0C0'  // Slightly darker gray than header
        },
        border: {
            left: {
                style: 'thin',
                color: '#000000'
            },
            right: {
                style: 'thin',
                color: '#000000'
            },
            top: {
                style: 'double',  // Double line on top to separate from data
                color: '#000000'
            },
            bottom: {
                style: 'thin',
                color: '#000000'
            }
        },
        numberFormat: 'h#,##0.00; (h#,##0.00); -'  // Include hour formatting
    })

    // Set column widths
    ws.column(1).setWidth(60)  // Branch column
    ws.column(2).setWidth(15)  // Month Total
    ws.column(3).setWidth(15)  // Development
    ws.column(4).setWidth(15)  // Maintenance

    // Apply header styles to first row
    ws.cell(1, 1).string('Branch').style(styleHeader)
    ws.cell(1, 2).string('Month Total').style(styleHeader)
    ws.cell(1, 3).string('Development').style(styleHeader)
    ws.cell(1, 4).string('Maintenance').style(styleHeader)

    let itemRow = 2
    let columnIndex = 0
    const branchRows = new Map() // Track row number for each branch

    // First pass: Create branch rows and set branch names
    for (const [day, {branches}] of Object.entries(dayResults)) {
        for (const branchName of Object.keys(branches)) {
            if (!branchRows.has(branchName)) {
                // Branch link or string:
                if (config.autolink?.enabled) {
                    const issueNumber = branchName.match(config.autolink.issue_regex)
                    if (issueNumber) {
                        const branchUrl = config.autolink.url
                            .replace('{{project}}', project)
                            .replace('{{issue}}', issueNumber[0])
                        ws.cell(itemRow, 1).link(branchUrl, branchName).style(styleDefault)
                    } else {
                        ws.cell(itemRow, 1).string(branchName).style(styleDefault)
                    }
                } else {
                    ws.cell(itemRow, 1).string(branchName).style(styleDefault)
                }

                // Development or maintenance:
                if (!branchName.match(config.include.ignore_regex)) {
                    ws.cell(itemRow, 3).string('x').style(styleDefault)
                } else {
                    ws.cell(itemRow, 4).string('x').style(styleDefault)
                }

                branchRows.set(branchName, itemRow)
                itemRow++
            }
        }
    }

    // Second pass: Fill in daily hours
    columnIndex = 0
    for (const [day, {branches}] of Object.entries(dayResults)) {
        // Set width for date columns
        ws.column(5 + columnIndex).setWidth(12)

        // Format the date for better readability
        const formattedDate = dayjs(day).format('MMM DD')
        ws.cell(1, 5 + columnIndex)
            .string(formattedDate)
            .style(styleHeader)

        for (const [branchName, branch] of Object.entries(branches)) {
            const rowNum = branchRows.get(branchName)
            ws.cell(rowNum, 5 + columnIndex)
                .number(branch.total)
                .style(styleHours)
        }
        columnIndex++
    }

    // Add formulas for totals
    const lastColLetter = String.fromCharCode(68 + columnIndex) // Start from 'E' (69) minus 1 to include the last column

    // Add SUM formula for each branch row
    for (const rowNum of branchRows.values()) {
        const startCol = xl.getExcelCellRef(rowNum, 5) // Should give us something like 'E3'
        const endCol = xl.getExcelCellRef(rowNum, 4 + columnIndex) // Should give us the last column for this row
        const formula = `SUM(${startCol}:${endCol})`
        ws.cell(rowNum, 2)
            .formula(formula)
            .style(styleHours)
    }

    // Then update the totals row section to use the new style
    ws.cell(itemRow, 1).string('Total:').style(styleTotalRow)
    ws.cell(itemRow, 2).formula(`SUM(B2:B${itemRow - 1})`).style(styleTotalRow)
    ws.cell(itemRow, 3).formula(`SUMIF(C2:C${itemRow - 1},"x",B2:B${itemRow - 1})`).style(styleTotalRow)
    ws.cell(itemRow, 4).formula(`SUMIF(D2:D${itemRow - 1},"x",B2:B${itemRow - 1})`).style(styleTotalRow)

    // Update the column totals to use the new style as well
    for (let i = 0; i < columnIndex; i++) {
        // Helper function to convert column number to Excel column letters
        const getExcelColumnName = (columnNumber: number): string => {
            let dividend = columnNumber
            let columnName = ''
            let modulo: number

            while (dividend > 0) {
                modulo = (dividend - 1) % 26
                columnName = String.fromCharCode(65 + modulo) + columnName
                dividend = Math.floor((dividend - modulo) / 26)
            }

            return columnName
        }

        const colLetter = getExcelColumnName(5 + i)
        ws.cell(itemRow, 5 + i)
            .formula(`SUM(${colLetter}2:${colLetter}${itemRow - 1})`)
            .style(styleTotalRow)
    }

    const filename = path.join(os.homedir(), `${ymd[0]}-${ymd[1]}-${user.username}.xlsx`)
    wb.write(filename)
    console.log(`${pc.green('excel export:')} ${filename}`)
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
    .option('fill-day', {
        alias: 'f',
        default: false,
        describe: 'Fill each day to 8 hours by proportionally increasing hours on tickets',
        type: 'boolean',
    })
    .command('report', 'Make an hour report (month)', () => {}, async(argv) => {
        if (argv.export && !['xlsx'].includes(argv.export)) {
            throw new Error(`Invalid output: ${argv.export}`)
        }
        const project = argv.project

        let developmentHours = 0, totalHours = 0, unknownHours = 0
        const date = new Date()
        date.setMonth(argv.month - 1)
        date.setFullYear(argv.year)
        const user = await fetchUser(argv.user)

        const dayResults = await fetchSummary(project, user, argv.year, argv.month)
        const options = {
            label: 'wakamonth 🕠',
            nodes: [],
        }

        if (!Object.keys(dayResults).length) {
            console.log(`No results found for ${project}/${user.id}-${argv.year}/${argv.month}`)
            process.exit(1)
        }

        let branchNameLength = 42

        const optionOverview= {label: pc.green('overview'), nodes: []}
        const optionDaily = {label: pc.green('daily'), nodes: []}

        for (const {day, data} of Object.values(dayResults)) {
            dayResults[day].branches = {}
            // For each day; aggregate branch data
            for (const resultSet of data) {
                // No rounding; just keep the Wakapi numbers here in minutes.
                for (const branch of resultSet.branches) {
                    if (branch.name.length > branchNameLength) {
                        branchNameLength = branch.name.length
                    }

                    const total = branch.total_seconds / 60
                    if (!(branch.name in dayResults[day].branches)) {
                        dayResults[day].branches[branch.name] = {total}
                    } else {
                        dayResults[day].branches[branch.name].total += total
                    }
                }
            }

            const branches = Object.entries(dayResults[day].branches)
            if (!branches.length) continue

            let spreadUnknown = 0

            const optionDay = {label: pc.blue(day), nodes: []}

            if (dayResults[day].branches.unknown) {
                const branchAmount = Object.keys(dayResults[day].branches).length - 1
                const unAllocatedHours = (Math.ceil(dayResults[day].branches.unknown.total / config.precision) * config.precision) / 60
                unknownHours += unAllocatedHours
                spreadUnknown = Math.ceil(dayResults[day].branches.unknown.total / branchAmount)

                if (config.spread_unallocated) {
                    optionDay.nodes.push({label: `${pc.white(`allocated unknown / branch (${branchAmount})`.padEnd(branchNameLength))} ${String((unAllocatedHours / branchAmount).toFixed(1)).padStart(5)}h`})
                }
                delete dayResults[day].branches.unknown
            }

            // First calculate the day total including all branches and spread unknown
            if (argv.fillDay) {
                const branchCount = Object.keys(dayResults[day].branches).length
                if (branchCount > 0) {  // Only proceed if there are branches
                    const targetMinutes = 8 * 60  // 8 hours in minutes

                    // First pass: count how many branches need minimum 1 hour
                    let smallTicketsCount = 0
                    let remainingBranchesTotal = 0

                    for (const [branchName, branch] of Object.entries(dayResults[day].branches)) {
                        if (branch.total < 60) {
                            smallTicketsCount++
                        } else {
                            remainingBranchesTotal += branch.total;
                        }
                    }

                    // Calculate remaining minutes after allocating 1 hour to small tickets
                    let remainingMinutes = targetMinutes - (smallTicketsCount * 60);

                    // Distribute time proportionally first
                    for (const [branchName, branch] of Object.entries(dayResults[day].branches)) {
                        if (branch.total < 60) {
                            branch.total = 60;  // Set minimum 1 hour
                        } else if (remainingBranchesTotal > 0) {
                            // Proportionally distribute remaining time to larger tickets
                            branch.total = (branch.total / remainingBranchesTotal) * remainingMinutes;
                        }
                    }
                    
                    // Round all branches to 30-minute increments
                    const halfHourInMinutes = 30
                    let roundedTotal = 0
                    let largestBranch = null
                    let largestAmount = 0
                    
                    for (const [branchName, branch] of Object.entries(dayResults[day].branches)) {
                        // Find the largest branch before rounding
                        if (branch.total > largestAmount) {
                            largestAmount = branch.total
                            largestBranch = branchName
                        }
                        
                        // Round to nearest half hour for all except largest branch
                        if (branchName !== largestBranch) {
                            branch.total = Math.round(branch.total / halfHourInMinutes) * halfHourInMinutes
                            roundedTotal += branch.total
                        }
                    }
                    
                    // Set largest branch to make total exactly 8 hours
                    if (largestBranch) {
                        dayResults[day].branches[largestBranch].total = targetMinutes - roundedTotal
                        
                        // Ensure the largest branch is also rounded to half hours if possible
                        // Only if the adjustment doesn't throw off the total
                        const idealRounded = Math.round(dayResults[day].branches[largestBranch].total / halfHourInMinutes) * halfHourInMinutes
                        if (Math.abs(idealRounded - dayResults[day].branches[largestBranch].total) <= 15) {
                            dayResults[day].branches[largestBranch].total = idealRounded
                            
                            // Distribute any tiny remainder to next largest if needed
                            const remainingDiff = targetMinutes - (roundedTotal + idealRounded)
                            if (Math.abs(remainingDiff) > 0.001) {
                                // Find next largest branch
                                let nextLargest = null
                                let nextLargestAmount = 0
                                for (const [branchName, branch] of Object.entries(dayResults[day].branches)) {
                                    if (branchName !== largestBranch && branch.total > nextLargestAmount) {
                                        nextLargestAmount = branch.total
                                        nextLargest = branchName
                                    }
                                }
                                
                                if (nextLargest) {
                                    dayResults[day].branches[nextLargest].total += remainingDiff
                                }
                            }
                        }
                    }
                }
            }

            for (const [branchName, branch] of Object.entries(dayResults[day].branches)) {
                // Rounding; assign unallocated hours (if applicable).
                if (config.spread_unallocated && !argv.fillDay) {
                    branch.total += spreadUnknown
                }

                // Only round if we're not filling the day
                if (!argv.fillDay) {
                    branch.total = (Math.ceil(branch.total / config.precision) * config.precision) / 60
                } else {
                    branch.total = branch.total / 60 // Just convert to hours without rounding
                }

                totalHours += branch.total

                if (!branchName.match(config.include.ignore_regex)) {
                    developmentHours += branch.total
                }

                optionDay.nodes.push({label: `${pc.white(branchName.padEnd(branchNameLength))} ${String(branch.total).padStart(5)}h`})
            }

            optionDaily.nodes.push(optionDay)
        }

        if (!Object.keys(dayResults).length) {
            console.log(`no branches found for project ${project}:${argv.month}/${argv.year}`)
            return
        }

        const maintenanceHours = totalHours - developmentHours
        optionOverview.nodes.push({label: `${pc.white('total'.padEnd(branchNameLength))} ${String(totalHours).padStart(5)}h`})
        optionOverview.nodes.push({label: `${pc.white('development'.padEnd(branchNameLength))} ${String(developmentHours).padStart(5)}h`})
        optionOverview.nodes.push({label: `${pc.white('maintenance'.padEnd(branchNameLength))} ${String(maintenanceHours).padStart(5)}h`})
        optionOverview.nodes.push({label: `${pc.white(config.spread_unallocated ? 'unknown (allocated)'.padEnd(branchNameLength) : 'unknown (unallocated)'.padEnd(branchNameLength))} ${String(unknownHours).padStart(5)}h`})
        options.nodes.push(optionDaily)

        options.nodes.push(optionOverview)
        archy(options).split('\r').forEach((line) => console.log(line))

        if (argv.export === 'xlsx') {
            outputExcel(user, project, dayResults, date, argv)
        }
    })
    .demandCommand(1)
    .parse()
