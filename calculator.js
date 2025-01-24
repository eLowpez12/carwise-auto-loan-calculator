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

// Update calculations
const updateCalculations = () => {
    const selectedValue = document.querySelector('.custom-select').getAttribute('data-value');
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
        
        // Use the schedule data for all displays
        monthlyPayment.textContent = `$${formatCurrency(schedule[0].payment)}`;
        totalPrincipal.textContent = `$${formatCurrency(principal)}`;
        totalInterest.textContent = `$${formatCurrency(schedule.reduce((sum, payment) => sum + payment.interest, 0))}`;
        payoffValue.textContent = formatPayoffDate(lastPayment.date);
    } else {
        monthlyPayment.textContent = '--';
        totalPrincipal.textContent = '--';
        totalInterest.textContent = '--';
        payoffValue.textContent = '--';
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

// Add tooltip functionality for info icons
const infoIcons = document.querySelectorAll('.info-icon');
const tooltipTexts = {
    'loan-amount': 'Enter the total amount you wish to borrow',
    'interest-rate': 'Enter the annual interest rate'
};

infoIcons.forEach(icon => {
    const input = icon.parentElement.getAttribute('for');
    if (tooltipTexts[input]) {
        icon.title = tooltipTexts[input];
    }
});

// Update tooltip handlers
document.querySelectorAll('.tooltip-icon').forEach(icon => {
    // Remove mouseover/mouseleave listeners
    icon.removeEventListener('mouseover', () => {});
    icon.removeEventListener('mouseleave', () => {});

    // Add click listener
    icon.addEventListener('click', (e) => {
        e.stopPropagation();  // Prevent click from bubbling
        const tooltip = e.currentTarget.querySelector('.tooltip');
        const allTooltips = document.querySelectorAll('.tooltip');
        const allIcons = document.querySelectorAll('.tooltip-icon');
        
        // Hide all other tooltips first
        allTooltips.forEach(t => t.classList.remove('show'));
        allIcons.forEach(i => i.classList.remove('active'));
        
        // Toggle current tooltip
        if (tooltip) {
            tooltip.classList.toggle('show');
            icon.classList.toggle('active');
        }
    });

    // Close tooltip when clicking outside
    document.addEventListener('click', () => {
        const allTooltips = document.querySelectorAll('.tooltip');
        const allIcons = document.querySelectorAll('.tooltip-icon');
        allTooltips.forEach(t => t.classList.remove('show'));
        allIcons.forEach(i => i.classList.remove('active'));
    });
});

// Update the dropdown functionality
document.addEventListener('DOMContentLoaded', function() {
    const customSelect = document.querySelector('.custom-select');
    const selectSelected = customSelect.querySelector('.select-selected');
    const selectItems = customSelect.querySelector('.select-items');
    const dropdownArrow = selectSelected.querySelector('.dropdown-arrow');

    // Toggle dropdown
    selectSelected.addEventListener('click', function(e) {
        e.stopPropagation();
        selectItems.classList.toggle('select-hide');
        selectSelected.classList.toggle('active');
        const isHidden = selectItems.classList.contains('select-hide');
        dropdownArrow.style.transform = isHidden ? 
            'translateY(-50%)' : 'translateY(-50%) rotate(180deg)';
    });

    // Handle option selection
    selectItems.querySelectorAll('div').forEach(item => {
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            const value = this.getAttribute('data-value');
            
            // Skip if clicking the "Select term" option
            if (!value) return;
            
            // Remove selected class from all items
            selectItems.querySelectorAll('div').forEach(div => div.classList.remove('selected'));
            // Add selected class to clicked item
            this.classList.add('selected');
            
            customSelect.setAttribute('data-value', value);
            selectSelected.classList.add('has-value');
            selectSelected.innerHTML = `${this.textContent}<div class="dropdown-arrow">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                    <path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>`;
            selectItems.classList.add('select-hide');
            dropdownArrow.style.transform = 'translateY(-50%)';
        });
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function() {
        selectItems.classList.add('select-hide');
        selectSelected.classList.remove('active');
        dropdownArrow.style.transform = 'translateY(-50%)';
    });

    // Set default date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('start-date').value = today;
});

// Add button click handler
document.querySelector('.compare-rates-btn').addEventListener('click', function() {
    updateCalculations();
});

// Update the show amortization function
const showAmortizationSchedule = () => {
    const selectedValue = document.querySelector('.custom-select').getAttribute('data-value');
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
};

// Remove old click handlers and update the link handler
document.querySelector('.amortization-link').addEventListener('click', (e) => {
    e.preventDefault();
    const container = document.querySelector('.amortization-section');
    const link = e.currentTarget;

    if (container.style.display === 'none' || !container.style.display) {
        showAmortizationSchedule();
        link.textContent = 'Hide amortization schedule';
    } else {
        container.style.display = 'none';
        container.querySelector('.details-content').classList.remove('show');
        link.textContent = 'See amortization schedule';
    }
});

// Add date formatting function
const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit'
    });
};

// Add event listener for date changes to update payoff date
document.getElementById('start-date').addEventListener('change', () => {
    updateCalculations();
    // Keep existing amortization table update logic
    const container = document.querySelector('.amortization-section');
    if (container.style.display === 'block') {
        showAmortizationSchedule();
    }
});

// Add print button handler
document.querySelector('.print-button').addEventListener('click', () => {
    window.print();
}); 