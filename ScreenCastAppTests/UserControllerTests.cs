using Microsoft.VisualStudio.TestTools.UnitTesting;
using ScreenCastApp;
using ScreenCastApp.Controllers;
using ScreenCastApp.Services;

namespace ScreenCastAppTests
{
    [TestClass]
    public class UserControllerTests
    {

        [TestMethod]
        public void SearchUser_NoFields()
        {
            // Arrange
            UserController userController = new UserController();

            string userName = "";
            string userPass = "";
            string expected = "CADENA VACIA";

            // Act
            string currentUser = userController.searchUser(userName, userPass);

            // Assert
            Assert.AreEqual(expected, currentUser, "Error en la comparación");
        }

        [TestMethod]
        public void SearchUser_NoUserName()
        {
            // Arrange
            UserController userController = new UserController();

            string userName = "";
            string userPass = "12345";
            string expected = "CADENA VACIA";

            // Act
            string currentUser = userController.searchUser(userName, userPass);

            // Assert
            Assert.AreEqual(expected, currentUser, "Error en la comparación");
        }

        [TestMethod]
        public void SearchUser_NoUserPass()
        {
            // Arrange
            UserController userController = new UserController();

            string userName = "Francisco";
            string userPass = "";
            string expected = "CADENA VACIA";

            // Act
            string currentUser = userController.searchUser(userName, userPass);

            // Assert
            Assert.AreEqual(expected, currentUser, "Error en la comparación");
        }

        [TestMethod]
        public void SearchUser_UserFoundCorrectly()
        {
            // Arrange
            UserController userController = new UserController();

            string userName = "Francisco";
            string userPass = "12345";
            string expected = "USUARIO ENCONTRADO";

            // Act
            string currentUser = userController.searchUser(userName, userPass);

            // Assert
            Assert.AreEqual(expected, currentUser, "Error en la comparación");
        }

        [TestMethod]
        public void CreateUser_NoFields()
        {
            // Arrange
            UserController userController = new UserController();

            string userSurname = "";
            string userName = "";
            string userPhone = "";
            string userGender = "";
            string userBirthDate = "";
            string userPass = "";
            string expected = "USUARIO NO CREADO";

            // Act
            string createdUser = userController.createUser(userSurname, userName, userPhone, userGender, userBirthDate, userPass);

            // Assert
            Assert.AreEqual(expected, createdUser, "Error en la comparación");
        }

        [TestMethod]
        public void CreateUser_UserCreatedCorrectly()
        {
            // Arrange
            UserController userController = new UserController();

            string userSurname = "Cervantes Zafón";
            string userName = "Matilde";
            string userPhone = "(+34) 111 222 333";
            string userGender = "female";
            string userBirthDate = "1987-07-18";
            string userPass = "11111";
            string expected = "USUARIO CREADO";

            // Act
            string createdUser = userController.createUser(userSurname, userName, userPhone, userGender, userBirthDate, userPass);

            // Assert
            Assert.AreEqual(expected, createdUser, "Error en la comparación");
        }

        

        

    }
}
