const fs = require('fs');
const path = require('path');

// Read and parse CSV data
function parseCSV(filePath) {
    const csvContent = fs.readFileSync(filePath, 'utf8');
    const lines = csvContent.trim().split('\n');
    const headers = lines[0].split(',');
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length === headers.length) {
            const row = {};
            headers.forEach((header, index) => {
                row[header.trim()] = values[index].trim();
            });
            data.push(row);
        }
    }
    
    return data;
}

// Convert date string to Date object
function parseDate(dateString) {
    const [day, month, year] = dateString.split('/');
    return new Date(year, month - 1, day);
}

// Get quarter from date
function getQuarter(date) {
    const month = date.getMonth() + 1;
    if (month <= 3) return 'Q1';
    if (month <= 6) return 'Q2';
    if (month <= 9) return 'Q3';
    return 'Q4';
}

// Calculate agent metrics
function calculateAgentMetrics(leads, agentName) {
    const agentLeads = leads.filter(lead => lead.Agents === agentName);
    const totalLeads = agentLeads.length;
    
    if (totalLeads === 0) {
        return {
            name: agentName,
            conversionRate: 0,
            totalLeads: 0,
            customers: 0,
            engagementRate: 0,
            quality: 0
        };
    }
    
    // Count conversions (successful statuses)
    const successfulStatuses = ['SUCCESSFUL', 'OPTIONS SENT', 'ATTEMPT'];
    const conversions = agentLeads.filter(lead => 
        successfulStatuses.includes(lead.Status)
    ).length;
    
    // Count active engagements (not junk or unsuccessful)
    const engagedLeads = agentLeads.filter(lead => 
        !['Junk Lead', 'UNSUCCESSFUL'].includes(lead.Status)
    ).length;
    
    // Calculate quality score based on conversion rate and engagement
    const conversionRate = (conversions / totalLeads) * 100;
    const engagementRate = (engagedLeads / totalLeads) * 100;
    const quality = (conversionRate * 0.6 + engagementRate * 0.4);
    
    return {
        name: agentName,
        conversionRate: Math.round(conversionRate * 10) / 10,
        totalLeads,
        customers: conversions,
        engagementRate: Math.round(engagementRate * 10) / 10,
        quality: Math.round(quality * 10) / 10
    };
}

// Process data for dashboard
function processDataForDashboard(csvFilePath) {
    const rawData = parseCSV(csvFilePath);
    
    // Parse dates and add quarter info
    const processedData = rawData.map(row => ({
        ...row,
        date: parseDate(row.Created),
        quarter: getQuarter(parseDate(row.Created))
    }));
    
    // Get unique agents (excluding CRM System)
    const agents = [...new Set(processedData
        .filter(row => row.Agents !== 'CRM System')
        .map(row => row.Agents))];
    
    // Group by quarters
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const dashboardData = {};
    
    quarters.forEach(quarter => {
        const quarterData = processedData.filter(row => row.quarter === quarter);
        
        if (quarterData.length === 0) {
            dashboardData[quarter] = {
                totalLeads: 0,
                totalConversions: 0,
                avgConversion: 0,
                agents: []
            };
            return;
        }
        
        const totalLeads = quarterData.length;
        const totalConversions = quarterData.filter(row => 
            ['SUCCESSFUL', 'OPTIONS SENT', 'ATTEMPT'].includes(row.Status)
        ).length;
        const avgConversion = Math.round((totalConversions / totalLeads) * 1000) / 10;
        
        // Calculate metrics for each agent
        const agentMetrics = agents.map(agent => 
            calculateAgentMetrics(quarterData, agent)
        ).filter(metrics => metrics.totalLeads > 0)
        .sort((a, b) => b.conversionRate - a.conversionRate)
        .slice(0, 10); // Top 10 agents
        
        dashboardData[quarter] = {
            totalLeads,
            totalConversions,
            avgConversion,
            agents: agentMetrics
        };
    });
    
    return dashboardData;
}

// Main execution
const csvFilePath = path.join(__dirname, 'Leads Management.csv');
const dashboardData = processDataForDashboard(csvFilePath);

// Generate JavaScript code for the dashboard
const jsCode = `const realData = ${JSON.stringify(dashboardData, null, 4)};`;

// Write to output file
fs.writeFileSync('dashboard-data.js', jsCode);

console.log('Dashboard data generated successfully!');
console.log('Data summary:');
['Q1', 'Q2', 'Q3', 'Q4'].forEach(quarter => {
    const data = dashboardData[quarter];
    console.log(`${quarter}: ${data.totalLeads} leads, ${data.totalConversions} conversions (${data.avgConversion}%), ${data.agents.length} active agents`);
});
