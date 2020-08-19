using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
using RazorPagesContacts.Models;
using ScreenCastApp.Controllers;
using System;

namespace ScreenCastApp.Pages
{
    public class CreateUserModel : PageModel
    {
        [BindProperty]
        public new User User { get; set; }

        public IActionResult OnPostAsync()
        {
            UserController userController = new UserController();

            var res2 = userController.createUser(User.Surname, User.Name, User.Phone, User.Gender, User.BirthDate, User.Password);

            Console.WriteLine("Name: " + User.Surname);
            Console.WriteLine("Name: " + User.Name);
            Console.WriteLine("Name: " + User.Phone);
            Console.WriteLine("Name: " + User.Gender);
            Console.WriteLine("Name: " + User.BirthDate);
            Console.WriteLine("Pass: " + User.Password);

            if (ModelState.IsValid && res2 != "USUARIO NO CREADO")
            {
                return RedirectToPage("./Login");
            }
            
            return RedirectToPage("./CreateUser");
            
        }
    }
}
