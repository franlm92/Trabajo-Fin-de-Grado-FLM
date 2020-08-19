using System;
using System.ComponentModel;
using System.ComponentModel.DataAnnotations;

namespace RazorPagesContacts.Models
{
    public class User
    {
        [Required]
        public string Surname { get; set; }

        [Required]
        public string Name { get; set; }

        [Required]
        [DataType(DataType.PhoneNumber)]
        public string Phone { get; set; }

        [Required]
        public string Gender { get; set; }

        [Required]
        [DataType(DataType.Date)]
        public string BirthDate { get; set; }

        [Required]
        [DataType(DataType.Password)]
        public string Password { get; set; }
    }
}