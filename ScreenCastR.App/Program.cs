using System;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using MongoDB.Bson;
using ScreenCastApp.Controllers;
using ScreenCastApp.Services;

namespace ScreenCastApp
{
    public class Program
    {
        public static void Main(string[] args)
        {
            CreateHostBuilder(args).Build().Run();
        }

        public static IHostBuilder CreateHostBuilder(string[] args) =>
            Host.CreateDefaultBuilder(args)
                .ConfigureWebHostDefaults(webBuilder =>
                {
                    UserController userController = new UserController();
                                   
                    webBuilder.UseStartup<Startup>();
                    webBuilder.UseUrls("https://localhost:5001", "http://localhost:5000");
                });
    }
}
