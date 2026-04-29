async function checkAuth() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) window.location.href = '/index.html';
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuth();

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await fetch('/api/auth/logout', { method: 'POST' });
      window.location.href = '/index.html';
    });
  }

  let instances = {};
  let currentData = {};

  const chartColors = [
    'rgba(75, 192, 192, 0.6)',
    'rgba(255, 99, 132, 0.6)',
    'rgba(255, 206, 86, 0.6)',
    'rgba(54, 162, 235, 0.6)',
    'rgba(153, 102, 255, 0.6)',
    'rgba(255, 159, 64, 0.6)'
  ];

  function renderChart(id, type, label, labels, dataPoints, colors=null, isHorizontal=false, applyInsightColors=false) {
    const ctx = document.getElementById(id).getContext('2d');
    if (instances[id]) { instances[id].destroy(); }
    
    let bgColor = colors || 'rgba(99, 102, 241, 0.8)';
    let borderColor = 'rgba(255,255,255,0.1)';
    let hoverBgColor = colors ? colors : 'rgba(99, 102, 241, 1)';

    const isPieOrDoughnut = (type === 'pie' || type === 'doughnut');
    const isRadar = (type === 'radar');
    const isLine = (type === 'line');

    // Consolidate tiny pie slices
    let renderLabels = labels;
    let renderData = dataPoints;
    if (isPieOrDoughnut && labels.length > 5) {
      renderLabels = labels.slice(0, 5);
      renderData = dataPoints.slice(0, 5);
      const otherSum = dataPoints.slice(5).reduce((a,b)=>a+b, 0);
      if (otherSum > 0) {
        renderLabels.push('Other');
        renderData.push(otherSum);
      }
    }

    // Color-coded insights for Skills Gap Bars
    if (applyInsightColors && !isPieOrDoughnut && !isRadar && !isLine) {
      bgColor = dataPoints.map(v => v >= 4 ? 'rgba(239, 68, 68, 0.8)' : (v >= 2 ? 'rgba(245, 158, 11, 0.8)' : 'rgba(56, 189, 248, 0.8)'));
      hoverBgColor = dataPoints.map(v => v >= 4 ? 'rgba(239, 68, 68, 1)' : (v >= 2 ? 'rgba(245, 158, 11, 1)' : 'rgba(56, 189, 248, 1)'));
    }

    instances[id] = new Chart(ctx, {
      type: type,
      data: {
        labels: renderLabels,
        datasets: [{
          label: label,
          data: renderData,
          backgroundColor: isPieOrDoughnut ? chartColors : bgColor,
          borderColor: isPieOrDoughnut ? '#0f172a' : (isLine || isRadar ? 'rgba(99, 102, 241, 1)' : borderColor),
          borderWidth: isPieOrDoughnut ? 2 : (isLine || isRadar ? 3 : 0),
          borderRadius: (isPieOrDoughnut || isLine || isRadar) ? 0 : 6,
          hoverBackgroundColor: isPieOrDoughnut ? chartColors : hoverBgColor,
          fill: isLine ? true : (isRadar ? true : false),
          tension: 0.4, // Smooth curves for line charts
          pointBackgroundColor: 'rgba(99, 102, 241, 1)'
        }]
      },
      options: {
        indexAxis: isHorizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1500,
          easing: 'easeOutQuart'
        },
        plugins: {
          legend: { 
            display: isPieOrDoughnut || isRadar || isLine, 
            position: isPieOrDoughnut ? 'bottom' : 'top', 
            labels: { color: '#94a3b8', font: { family: 'Poppins', size: 11 }, padding: 10 }
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.9)',
            titleFont: { family: 'Poppins', size: 13 },
            bodyFont: { family: 'Poppins', size: 12 },
            padding: 10,
            cornerRadius: 8,
            displayColors: isPieOrDoughnut,
            callbacks: {
              label: function(context) {
                if (isPieOrDoughnut) {
                  let sum = context.dataset.data.reduce((a, b) => a + b, 0);
                  let val = context.raw;
                  let percentage = ((val * 100) / sum).toFixed(1) + '%';
                  return ` ${context.label}: ${val} (${percentage})`;
                }
                return ` ${context.label}: ${context.raw}`;
              },
              afterBody: applyInsightColors ? function(ctxArr) {
                const val = ctxArr[0].raw;
                if(val >= 4) return 'Insight: Critical Gap!';
                if(val >= 2) return 'Insight: Significant Gap';
                return 'Insight: Emerging Gap';
              } : undefined
            }
          }
        },
        scales: (isPieOrDoughnut || isRadar) ? {} : {
          x: { 
            grid: { display: false, drawBorder: false },
            ticks: { 
              color: '#94a3b8', 
              font: { family: 'Poppins' },
              callback: function(value) {
                if (isHorizontal) return value;
                const lbl = this.getLabelForValue(value) || '';
                return lbl.length > 15 ? lbl.substring(0, 15) + '...' : lbl;
              }
            }
          },
          y: { 
            grid: { color: 'rgba(255,255,255,0.05)', drawBorder: false },
            ticks: { 
              color: '#94a3b8', 
              font: { family: 'Poppins' },
              stepSize: 1,
              callback: function(value) {
                if (!isHorizontal) return value;
                const lbl = this.getLabelForValue(value) || '';
                return lbl.length > 15 ? lbl.substring(0, 15) + '...' : lbl;
              }
            }
          }
        }
      }
    });
  }

  async function loadData() {
    const prog = document.getElementById('filter-programme').value;
    const year = document.getElementById('filter-year').value;
    const industryInput = document.getElementById('filter-industry');
    const ind = industryInput ? industryInput.value : '';

    const q = new URLSearchParams();
    if (prog) q.set('programme', prog);
    if (year) q.set('gradYear', year);
    if (ind) q.set('industry', ind);
    
    const query = q.toString() ? `?${q.toString()}` : '';

    const chartsGrid = document.getElementById('charts-grid');
    if (chartsGrid) chartsGrid.classList.add('loading-overlay');

    try {
      const [gap, ind, job, emp, geo] = await Promise.all([
        fetch(`/api/dashboard/skills-gap${query}`).then(r=>r.json()),
        fetch(`/api/dashboard/employment-by-industry${query}`).then(r=>r.json()),
        fetch(`/api/dashboard/top-job-titles${query}`).then(r=>r.json()),
        fetch(`/api/dashboard/top-employers${query}`).then(r=>r.json()),
        fetch(`/api/dashboard/geographic${query}`).then(r=>r.json())
      ]);

      currentData = { gap, ind, job, emp, geo };

      if(gap.certifications) {
        // Bar with Insights
        renderChart('chart-certs', 'bar', 'Certifications (Count)', gap.certifications.map(c=>c.title), gap.certifications.map(c=>c.count), null, true, true);
      }
      if(gap.courses) {
        // Restore standard Horizontal Bar for Courses
        renderChart('chart-courses', 'bar', 'Courses', gap.courses.map(c=>c.title), gap.courses.map(c=>c.count), chartColors[1], true, true);
      }
      if(gap.licences) {
        // Licences Bar with insights
        renderChart('chart-licences', 'bar', 'Licences (Count)', gap.licences.map(c=>c.title), gap.licences.map(c=>c.count), null, true, true);
      }
      
      if(ind.data) {
        renderChart('chart-industry', 'pie', 'Industry', ind.data.map(i=>i.sector), ind.data.map(i=>i.count), chartColors);
      }
      
      if(job.data) {
        renderChart('chart-jobs', 'doughnut', 'Titles', job.data.map(i=>i.title), job.data.map(i=>i.count), chartColors);
      }

      if(emp.data) {
        renderChart('chart-employers', 'bar', 'Employers', emp.data.map(i=>i.company), emp.data.map(i=>i.count), chartColors[4], false);
      }
      
      if(geo.data) {
        renderChart('chart-geo', 'bar', 'Location', geo.data.map(i=>i.location), geo.data.map(i=>i.count), chartColors[5], false);
      }

    } catch (err) {
      console.error(err);
    } finally {
      if (chartsGrid) chartsGrid.classList.remove('loading-overlay');
    }
  }

  document.getElementById('apply-filters').addEventListener('click', loadData);

  document.querySelectorAll('.btn-download').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.target.getAttribute('data-target');
      const inst = instances[targetId];
      if (inst) {
        const a = document.createElement('a');
        a.href = inst.toBase64Image();
        a.download = `${targetId}.png`;
        a.click();
      }
    });
  });

  document.getElementById('export-csv').addEventListener('click', () => {
    let csv = 'Category,Label,Count\n';
    
    if(currentData.gap && currentData.gap.certifications) {
      currentData.gap.certifications.forEach(r => csv += `"Skills Gap: Certifications","${r.title}",${r.count}\n`);
    }
    
    if(currentData.gap && currentData.gap.courses) {
      currentData.gap.courses.forEach(r => csv += `"Skills Gap: Courses","${r.title}",${r.count}\n`);
    }
    
    if(currentData.ind && currentData.ind.data) {
      currentData.ind.data.forEach(r => csv += `"Employment by Industry","${r.sector}",${r.count}\n`);
    }
    
    if(currentData.job && currentData.job.data) {
      currentData.job.data.forEach(r => csv += `"Top Job Titles","${r.title}",${r.count}\n`);
    }
    
    if(currentData.emp && currentData.emp.data) {
      currentData.emp.data.forEach(r => csv += `"Top Employers","${r.company}",${r.count}\n`);
    }
    
    if(currentData.geo && currentData.geo.data) {
      currentData.geo.data.forEach(r => csv += `"Geographic Distribution","${r.location}",${r.count}\n`);
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analytics-export.csv';
    a.click();
  });

  loadData();
});
