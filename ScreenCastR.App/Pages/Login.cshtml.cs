using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using Microsoft.Extensions.Logging;
using RazorPagesContacts.Models;
using ScreenCastApp.Controllers;
using System;
using System.Threading.Tasks;

namespace ScreenCastApp.Pages
{
    public class LoginModel : PageModel
    {
        [BindProperty]
        public new User User { get; set; }

        public IActionResult OnPostAsync()
        {
            UserController userController = new UserController();
            
            var res = userController.searchUser(User.Name, User.Password);

            if (res != "CADENA VACIA")
            {
                return Redirect("https://localhost:5001/main");
            }

            return Page();
        }

        public ActionResult CreateUser()
        {
            Console.WriteLine("Entra");
            return RedirectToPage("./CreateUser");
        }

        public void OnCreateUser()
        {
            Console.WriteLine("Entra");
            RedirectToPage("./CreateUser");
        }
    }
}