const cron = require("node-cron");
const puppeteer = require("puppeteer-core");
const { Resend } = require("resend");
require("dotenv").config();

const resend = new Resend(process.env.RESEND_API_KEY);

// Function to send attendance email
const sendAttendanceEmail = async () => {
  try {
    const browser = await puppeteer.launch({
      headless: true,
      executablePath: "/usr/bin/chromium-browser",
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--start-maximized"],
    });

    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);

    console.log("Navigating to the login page...");
    await page.goto("https://mujslcm.jaipur.manipal.edu/", {
      waitUntil: "networkidle2",
    });

    console.log("Logging in...");
    await page.type("#txtUserName", "mohit.229310069");
    await page.type("#txtPassword", process.env.PASSWORD);
    await page.click("#login_submitStudent");

    console.log("Navigating to Attendance Summary...");
    await page.goto(
      "https://mujslcm.jaipur.manipal.edu/Student/Academic/AttendanceSummaryForStudent/",
      {
        waitUntil: "networkidle2",
      }
    );

    console.log("Waiting for Attendance Table...");
    await page.waitForSelector("#dvDetail > div", {
      visible: true,
      timeout: 60000,
    });

    console.log("Extracting attendance data...");
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
                      .map(
                        (row) =>
                          `<tr>${row
                            .map((cell) => `<td>${cell}</td>`)
                            .join("")}</tr>`
                      )
                      .join("")}
                </tbody>
            </table>
        `;

    console.log("Sending email...");
    await resend.emails.send({
      from: "Attendance <onboarding@resend.dev>",
      to: "mohithingorani2003@gmail.com",
      subject: "Your Daily Attendance Summary",
      html: `<h1>Your Attendance Summary</h1>${attendanceTableHtml}`,
    });

    console.log("Email sent successfully!");

    await browser.close();
    return 1;
  } catch (error) {
    console.error("An error occurred:", error.message);
    return 0;
  }
};

while (sendAttendanceEmail() == 0) {
  sendAttendanceEmail();
}
