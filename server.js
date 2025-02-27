const puppeteer = require("puppeteer-core");
const { Resend } = require("resend");
require("dotenv").config();
const fs = require("fs");

const resend = new Resend(process.env.RESEND_API_KEY);
const LOG_FILE = "attendance_log.txt";

// Function to log messages
const logMessage = (message) => {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
  console.log(message);
};

// Function to send attendance email
const sendAttendanceEmail = async () => {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: false,
      executablePath: "/usr/bin/chromium-browser",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);

    logMessage("Navigating to the login page...");
    await page.goto("https://mujslcm.jaipur.manipal.edu/", {
      waitUntil: "networkidle2",
    });

    logMessage("Clearing cookies and local storage...");
    // await page.deleteCookie(...(await page.cookies()));
    await page.evaluate(() => localStorage.clear());

    logMessage("Logging in...");
    await page.type("#txtUserName", "mohit.229310069");
    await page.type("#txtPassword", process.env.PASSWORD);
    await page.click("#login_submitStudent");

    logMessage("Navigating to Attendance Summary...");
    await page.goto(
      "https://mujslcm.jaipur.manipal.edu/Student/Academic/AttendanceSummaryForStudent/",
      {
        waitUntil: "networkidle2",
      }
    );

    logMessage("Waiting for Attendance Table...");
    let retries = 3;
    while (retries > 0) {
      try {
        await page.waitForSelector("#dvDetail > div", { visible: true, timeout: 40000 });
        break;
      } catch (err) {
        logMessage("Retrying to find Attendance Table...");
        retries--;
      }
    }

    logMessage("Extracting attendance data...");
    const attendanceData = await page.evaluate(() => {
      const table = document.querySelector("#kt_ViewTable");
      if (!table) throw new Error("Attendance table not found!");

      const rows = Array.from(table.querySelectorAll("tr"));
      return rows.map((row) => {
        const cells = Array.from(row.querySelectorAll("td"));
        return cells.map((cell) => cell.innerText.trim());
      });
    });

    const attendanceTableHtml = `
      <table border="1" style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr>
            <th>#</th>
            <th>Subject</th>
            <th>Grade</th>
            <th>Batch</th>
            <th>Classes Attended</th>
            <th>Total Classes</th>
            <th>Percentage</th>
          </tr>
        </thead>
        <tbody>
          ${attendanceData
            .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
            .join("")}
        </tbody>
      </table>`;

    logMessage("Sending email...");
    await resend.emails.send({
      from: "Attendance <onboarding@resend.dev>",
      to: "mohithingorani2003@gmail.com",
      subject: "Your Daily Attendance Summary",
      html: `<h1>Your Attendance Summary</h1>${attendanceTableHtml}`,
    });

    logMessage("Email sent successfully!");
    await browser.close();
    return 1;
  } catch (error) {
    logMessage(`An error occurred: ${error.message}`);
    if (browser) await browser.close();
    return 0;
  }
};

sendAttendanceEmail();