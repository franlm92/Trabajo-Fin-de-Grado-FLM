using System;
using OpenQA.Selenium;
using OpenQA.Selenium.Firefox;

namespace SeleniumTests
{
    class Program
    {
        static void Main(string[] args)
        {
            IWebDriver driver = new FirefoxDriver();
            driver.Navigate().GoToUrl("https://localhost:5001");
            driver.Manage().Window.Maximize();

            IWebElement inputName = driver.FindElement(By.Id("User_Name"));
            IWebElement inputPass = driver.FindElement(By.Id("User_Password"));

            inputName.SendKeys("Francisco");
            inputPass.SendKeys("12345");

            IWebElement loginBtn = driver.FindElement(By.Id("Submit"));

            loginBtn.Click();

            //LoginTests loginTests = new LoginTests();
            //loginTests.LoginCorrectly(driver);
        }
    }
}
