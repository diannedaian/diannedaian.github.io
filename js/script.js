(function ($) {
  "use strict";

  // init Isotope
  var initIsotope = function () {
    var $grid = $(".grid");
    var $buttonGroup = $(".button-group");
    var $checked = $buttonGroup.find(".is-checked");
    var filterValue = $checked.attr("data-filter");

    // Initialize Isotope only once
    $grid.isotope({
      itemSelector: ".portfolio-item",
      filter: filterValue,
      initLayout: false,
    });

    // Show grid after Isotope is initialized
    $grid.addClass("isotope-ready");

    // Trigger layout after a short delay to ensure smooth transition
    setTimeout(function () {
      $grid.isotope("layout");
    }, 100);

    // bind filter button click - use event delegation
    $buttonGroup.off("click", "a").on("click", "a", function (e) {
      e.preventDefault();

      // Update button states
      $buttonGroup.find("a").removeClass("is-checked");
      $(this).addClass("is-checked");

      // Update filter
      var newFilterValue = $(this).attr("data-filter");
      $grid.isotope({ filter: newFilterValue });
    });
  };

  var initScrollNav = function () {
    var scroll = $(window).scrollTop();
    console;

    if (scroll >= 200) {
      $("#header.fixed-top").addClass("bg-white");
    } else {
      $("#header.fixed-top").removeClass("bg-white");
    }
  };

  // init Chocolat light box
  var initChocolat = function () {
    Chocolat(document.querySelectorAll(".image-link"), {
      imageSize: "contain",
      loop: true,
    });
  };

  // ------------------------------------------------------------------------------ //
  // Overlay Menu Navigation
  // ------------------------------------------------------------------------------ //
  var overlayMenu = function () {
    if (!$(".nav-overlay").length) {
      return false;
    }

    var body = undefined;
    var menu = undefined;
    var menu_close = undefined;
    var menuItems = undefined;
    var init = function init() {
      body = document.querySelector("body");
      menu = document.querySelector("#menu-btn");
      menu_close = document.querySelector("#menu-btn-close");
      menuItems = document.querySelectorAll(".nav__list-item");
      applyListeners();
    };
    var applyListeners = function applyListeners() {
      menu.addEventListener("click", function () {
        return toggleClass(body, "nav-active");
      });
      menu_close.addEventListener("click", function () {
        return toggleClass(body, "nav-active");
      });
    };
    var toggleClass = function toggleClass(element, stringClass) {
      if (element.classList.contains(stringClass))
        element.classList.remove(stringClass);
      else element.classList.add(stringClass);
    };
    init();
  };

  $(document).ready(function () {
    initScrollNav();
    overlayMenu();
    initChocolat();

    AOS.init({
      duration: 1000,
      once: true,
    });

    $("#btn-menu").click(function (e) {
      e.preventDefault();
      $(".sidebar-menu").toggleClass("open");
    });

    // Initialize Isotope earlier for better performance
    initIsotope();
  }); // End of a document

  $(window).scroll(function () {
    initScrollNav();
  });
})(jQuery);
