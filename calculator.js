// Utility functions
const formatCurrency = (value) => {
    // Make sure value is a number
    const number = typeof value === 'string' ? value.replace(/\D/g, '') : Math.round(value);
    
    // Convert to number and format
    const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(number);

    // Remove the currency symbol as we'll add it separately
    return formatted.replace('$', '');
};

const calculateLoanPayment = (principal, annualRate, months) => {
    const monthlyRate = (annualRate / 100) / 12;
    const monthlyPayment = principal * 
        (monthlyRate * Math.pow(1 + monthlyRate, months)) / 
        (Math.pow(1 + monthlyRate, months) - 1);
    
    const totalPaid = monthlyPayment * months;
    const totalInterest = totalPaid - principal;

    return {
        monthlyPayment: monthlyPayment,
        totalInterest: totalInterest,
        totalPrincipal: principal
    };
};

// Add this function to calculate amortization schedule
const calculateAmortizationSchedule = (principal, annualRate, months, startDate) => {
    const monthlyRate = (annualRate / 100) / 12;
    const monthlyPayment = principal * 
        (monthlyRate * Math.pow(1 + monthlyRate, months)) / 
        (Math.pow(1 + monthlyRate, months) - 1);
    
    let balance = principal;
    const schedule = [];
    
    // Create date at noon to avoid timezone issues
    const [year, month, day] = startDate.split('-');
    const paymentDate = new Date(year, month - 1, day, 12, 0, 0);

    for (let month = 0; month < months; month++) {
        if (month > 0) {
            // Handle month end dates correctly
            const currentMonth = paymentDate.getMonth();
            paymentDate.setMonth(currentMonth + 1);
            // If the date changed (rolled over), set to last day of desired month
            if (paymentDate.getMonth() !== ((currentMonth + 1) % 12)) {
                paymentDate.setDate(0); // Last day of previous month
            }
        }

        schedule.push({
            date: new Date(paymentDate),
            payment: monthlyPayment,
            principal: monthlyPayment - (balance * monthlyRate),
            interest: balance * monthlyRate,
            balance: Math.max(0, balance - (monthlyPayment - (balance * monthlyRate)))
        });

        balance = Math.max(0, balance - (monthlyPayment - (balance * monthlyRate)));
    }

    return schedule;
};

// DOM Elements
const loanAmountInput = document.getElementById('loan-amount');
const interestRateInput = document.getElementById('interest-rate');

// Input formatting and validation
const formatInputValue = (input, allowDecimals = false) => {
    let value = input.value.replace(/[^\d.]/g, '');
    if (allowDecimals) {
        const parts = value.split('.');
        if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');
        if (parts[1]) value = parts[0] + '.' + parts[1].slice(0, 2);
    } else {
        value = value.split('.')[0];
    }
    return value;
};

// Add this function to format the payoff date
const formatPayoffDate = (date) => {
    return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
    }).replace(/(\d+)(?=(,\s\d{4}))/, (match) => {
        const day = parseInt(match);
        // Fix ordinal suffix logic
        if (day > 3 && day < 21) return day + 'th';
        switch (day % 10) {
            case 1: return day + 'st';
            case 2: return day + 'nd';
            case 3: return day + 'rd';
            default: return day + 'th';
        }
    });
};

// Add state management
let isCalculating = false;

// Add utility function for delay
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Show/Hide Preloader Functions
function showPreloader() {
    const preloader = document.getElementById('preloader');
    preloader.classList.add('show');
}

function hidePreloader() {
    const preloader = document.getElementById('preloader');
    preloader.classList.remove('show');
}

// Update calculations
const updateCalculations = async () => {
    if (isCalculating) return;
    isCalculating = true;
    showPreloader();

    try {
        const selectedValue = document.getElementById('loanTerm').value;
        const principal = parseFloat(loanAmountInput.value.replace(/[^\d.]/g, '')) || 0;
        const term = parseFloat(selectedValue) || 0;
        const rate = parseFloat(interestRateInput.value) || 0;
        const startDate = document.getElementById('start-date').value;

        // Get the display elements
        const monthlyPayment = document.querySelector('.payment-amount .amount');
        const totalPrincipal = document.querySelector('.detail-row:nth-child(1) .value');
        const totalInterest = document.querySelector('.detail-row:nth-child(2) .value');
        const payoffValue = document.querySelector('.payoff-value');

        if (principal > 0 && term > 0 && rate > 0 && startDate) {
            // Calculate the full schedule once
            const schedule = calculateAmortizationSchedule(principal, rate, term, startDate);
            const lastPayment = schedule[schedule.length - 1];
            const totalInterestPaid = schedule.reduce((sum, payment) => sum + payment.interest, 0);
            
            // Create a minimum delay
            await delay(1000);
            
            // Use the schedule data for all displays
            monthlyPayment.textContent = `$${formatCurrency(schedule[0].payment)}`;
            totalPrincipal.textContent = `$${formatCurrency(principal)}`;
            totalInterest.textContent = `$${formatCurrency(totalInterestPaid)}`;
            document.querySelector('.detail-row .total-amount').textContent = `$${formatCurrency(principal + totalInterestPaid)}`;
            payoffValue.textContent = formatPayoffDate(lastPayment.date);

            // Populate amortization data for printing
            document.querySelector('.loan-amount-value').textContent = `$${formatCurrency(principal)}`;
            document.querySelector('.loan-term-value').textContent = `${term} months`;
            document.querySelector('.interest-rate-value').textContent = `${rate}%`;
            document.querySelector('.start-date-value').textContent = formatDate(startDate);
            document.querySelector('.payment-summary .payment-value').textContent = `$${formatCurrency(schedule[0].payment)}`;
            document.querySelector('.payment-summary .principal-value').textContent = `$${formatCurrency(principal)}`;
            document.querySelector('.payment-summary .interest-value').textContent = `$${formatCurrency(totalInterestPaid)}`;
            document.querySelector('.payment-summary .total-paid-value').textContent = `$${formatCurrency(principal + totalInterestPaid)}`;

            // Populate the table
            const tableBody = document.getElementById('amortization-table-body');
            tableBody.innerHTML = '';
            schedule.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatDate(row.date)}</td>
                    <td>$${formatCurrency(row.payment)}</td>
                    <td>$${formatCurrency(row.principal)}</td>
                    <td>$${formatCurrency(row.interest)}</td>
                    <td>$${formatCurrency(row.balance)}</td>
                `;
                tableBody.appendChild(tr);
            });
        } else {
            monthlyPayment.textContent = '--';
            totalPrincipal.textContent = '--';
            totalInterest.textContent = '--';
            document.querySelector('.detail-row .total-amount').textContent = '--';
            payoffValue.textContent = '--';

            // Clear amortization data
            document.querySelector('.loan-amount-value').textContent = '--';
            document.querySelector('.loan-term-value').textContent = '--';
            document.querySelector('.interest-rate-value').textContent = '--';
            document.querySelector('.start-date-value').textContent = '--';
            document.querySelector('.payment-summary .payment-value').textContent = '--';
            document.querySelector('.payment-summary .principal-value').textContent = '--';
            document.querySelector('.payment-summary .interest-value').textContent = '--';
            document.querySelector('.payment-summary .total-paid-value').textContent = '--';
            document.getElementById('amortization-table-body').innerHTML = '';
        }
    } catch (error) {
        console.error('Error in calculations:', error);
    } finally {
        hidePreloader();
        isCalculating = false;
    }
};

// Event Listeners
const inputs = [loanAmountInput, interestRateInput];

// Update the interest rate input handler
inputs.forEach(input => {
    if (input.id === 'interest-rate') {
        input.addEventListener('input', (e) => {
            const allowDecimals = true;
            let value = formatInputValue(e.target, allowDecimals);
            // Remove % if it exists before formatting
            value = value.replace('%', '');
            e.target.value = value;
            validateMaxValue(e.target);
        });

        // Add % on blur
        input.addEventListener('blur', function() {
            if (this.value) {
                this.value = this.value + '%';
            }
        });

        // Remove % on focus
        input.addEventListener('focus', function() {
            this.value = this.value.replace('%', '');
        });
    }

    if (input.id === 'loan-amount') {
        input.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value) {
                // Remove $ if it exists
                value = value.replace('$', '');
                e.target.value = value;
            }
        });

        input.addEventListener('focus', function() {
            // On focus, remove currency formatting and $ symbol
            this.value = this.value.replace(/[$,]/g, '');
        });

        input.addEventListener('blur', function() {
            if (this.value) {
                // On blur, add currency formatting and $ symbol
                this.value = '$' + formatCurrency(this.value);
            }
        });
    }
});

// Add input validation for maximum values
const validateMaxValue = (input) => {
    const maxValues = {
        'loan-amount': 1000000, // $1M max loan
        'interest-rate': 99.99 // Maximum interest rate
    };

    const value = parseFloat(input.value.replace(/[^\d.]/g, ''));
    const maxValue = maxValues[input.id];

    if (value > maxValue) {
        input.value = maxValue;
    }
};

// Add help icon tooltip functionality
document.querySelectorAll('.help-icon').forEach(icon => {
    const tooltip = icon.getAttribute('data-tooltip');
    
    icon.addEventListener('click', (e) => {
        e.stopPropagation();
        const existingTooltip = document.querySelector('.tooltip.show');
        if (existingTooltip) {
            existingTooltip.remove();
        }
        
        const tooltipElement = document.createElement('div');
        tooltipElement.className = 'tooltip show';
        tooltipElement.textContent = tooltip;
        icon.appendChild(tooltipElement);
    });
});

document.addEventListener('click', () => {
    const tooltips = document.querySelectorAll('.tooltip.show');
    tooltips.forEach(tooltip => tooltip.remove());
});

// Set default date to today when page loads
document.addEventListener('DOMContentLoaded', function() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('start-date').value = today;
});

// Add button click handlers
document.querySelector('.compare-rates-btn').addEventListener('click', async function() {
    await updateCalculations();
});

document.querySelector('.amortization-link').addEventListener('click', async (e) => {
    e.preventDefault();
    const container = document.querySelector('.amortization-section');
    const link = e.currentTarget;

    if (container.style.display === 'none' || !container.style.display) {
        await showAmortizationSchedule();
        link.textContent = 'Hide amortization schedule';
    } else {
        container.style.display = 'none';
        container.querySelector('.details-content').classList.remove('show');
        link.textContent = 'See amortization schedule';
    }
});

// Add print button handler
document.querySelector('.print-button').addEventListener('click', () => {
    window.print();
});

// Update the show amortization function
const showAmortizationSchedule = async () => {
    try {
        const selectedValue = document.getElementById('loanTerm').value;
        const principal = parseFloat(loanAmountInput.value.replace(/[^\d.]/g, '')) || 0;
        const term = parseFloat(selectedValue) || 0;
        const rate = parseFloat(interestRateInput.value) || 0;
        const startDate = document.getElementById('start-date').value;

        if (principal > 0 && term > 0 && rate > 0) {
            const effectiveStartDate = startDate || new Date().toISOString().split('T')[0];
            const schedule = calculateAmortizationSchedule(principal, rate, term, effectiveStartDate);
            
            // Update payoff date using last payment date
            const payoffValue = document.querySelector('.payoff-value');
            const lastPayment = schedule[schedule.length - 1];
            payoffValue.textContent = formatPayoffDate(lastPayment.date);

            // Update loan details
            document.querySelector('.loan-amount-value').textContent = `$${formatCurrency(principal)}`;
            document.querySelector('.loan-term-value').textContent = `${term} months`;
            document.querySelector('.interest-rate-value').textContent = `${rate}%`;
            document.querySelector('.start-date-value').textContent = formatDate(effectiveStartDate);

            // Update payment summary values
            document.querySelector('.payment-summary .payment-value').textContent = `$${formatCurrency(schedule[0].payment)}`;
            document.querySelector('.payment-summary .principal-value').textContent = `$${formatCurrency(principal)}`;
            const totalInterest = schedule.reduce((sum, payment) => sum + payment.interest, 0);
            document.querySelector('.payment-summary .interest-value').textContent = `$${formatCurrency(totalInterest)}`;
            document.querySelector('.payment-summary .total-paid-value').textContent = `$${formatCurrency(principal + totalInterest)}`;

            const tableBody = document.getElementById('amortization-table-body');
            tableBody.innerHTML = '';

            // Update table header
            document.querySelector('.amortization-table thead tr').innerHTML = `
                <th>Payment Date</th>
                <th>Payment</th>
                <th>Principal</th>
                <th>Interest</th>
                <th>Balance</th>
            `;

            schedule.forEach(row => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${formatDate(row.date)}</td>
                    <td>$${formatCurrency(row.payment)}</td>
                    <td>$${formatCurrency(row.principal)}</td>
                    <td>$${formatCurrency(row.interest)}</td>
                    <td>$${formatCurrency(row.balance)}</td>
                `;
                tableBody.appendChild(tr);
            });

            // Show the container
            const container = document.querySelector('.amortization-section');
            container.style.display = 'block';
            container.querySelector('.details-content').classList.add('show');
            container.scrollIntoView({ behavior: 'smooth' });
        } else {
            alert('Please calculate your loan payment first.');
        }
    } catch (error) {
        console.error('Error showing amortization schedule:', error);
    }
};

// Add date formatting function
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit'
    });
};

// Add event listener for date changes to update payoff date
document.getElementById('start-date').addEventListener('change', async () => {
    await updateCalculations();
    // Keep existing amortization table update logic
    const container = document.querySelector('.amortization-section');
    if (container.style.display === 'block') {
        await showAmortizationSchedule();
    }
}); 