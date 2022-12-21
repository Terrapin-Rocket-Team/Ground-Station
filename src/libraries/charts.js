const createChart = (id, name, xUnits, yUnits, xConvert, yConvert) => {
  return new Chart(document.getElementById(id), {
    type: "line",
    data: {
      labels: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      datasets: [
        {
          label: name,
          data: [],
        },
      ],
    },
    options: {
      aspectRatio: 1.5,
      animation: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          enabled: false,
        },
      },
      scales: {
        x: {
          ticks: {
            callback: (value) => `${value * xConvert} ${xUnits}`,
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => `${value * yConvert} ${yUnits}`,
          },
        },
      },
    },
  });
};
