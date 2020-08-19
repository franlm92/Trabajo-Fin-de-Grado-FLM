using System;
using System.Collections.Generic;
using System.Text;
using OpenQA.Selenium;
using OpenQA.Selenium.Firefox;

namespace SeleniumTests
{
    class LoginTests
    {
        public void LoginCorrectly(IWebDriver driver)
        {
            IWebElement inputName = driver.FindElement(By.Id("User_Name"));
            IWebElement inputPass = driver.FindElement(By.Id("User_Password"));

            inputName.SendKeys("Francisco");
            inputPass.SendKeys("12345");

            IWebElement loginBtn = driver.FindElement(By.Id("Submit"));

            loginBtn.Click();
        }
    }
}
