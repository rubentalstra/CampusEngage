/* eslint-disable */
$(document).ready(function () {

    if ($('.navbar-toggle').length) {
        $toggleButton = $('.navbar-toggle');
        $toggleButton.on('click', function () {
            if ($toggleButton.hasClass('collapsed')) {
                $('body').addClass('has-overlay');
                $toggleButton.find('.fa').removeClass('fa-bars').addClass('fa-close');
            } else {
                $('body').removeClass('has-overlay');
                $toggleButton.find('.fa').removeClass('fa-close').addClass('fa-bars');
            }
        });
    }

    function initSubmenuMobile() {
        // Add class to menu items with submenu
        $('.sf-menu li > ul').each(function () {
            $(this).parent('li')
                .addClass('has-submenu')
                .append('<button class="submenu-trigger"><svg aria-hidden="true" data-icon="chevron-down" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M207.029 381.476L12.686 187.132c-9.373-9.373-9.373-24.569 0-33.941l22.667-22.667c9.357-9.357 24.522-9.375 33.901-.04L224 284.505l154.745-154.021c9.379-9.335 24.544-9.317 33.901.04l22.667 22.667c9.373 9.373 9.373 24.569 0 33.941L240.971 381.476c-9.373 9.372-24.569 9.372-33.942 0z"/></svg></button>');
        });

        $('.submenu-trigger').on('click', function () {
            $(this).parent('.has-submenu').toggleClass('is-active');
        })
    }

    initSubmenuMobile();

    // Superfish menu
    breakpoint = 991;
    body = $('body');
    sf = $('ul.sf-menu');
    windowWidth = $(window).width();

    if (body.width() >= breakpoint) {
        // enable superfish when the page first loads if we're on desktop
        sf.superfish({
            pathClass: 'path',
            pathLevels: 0,
            cssArrows: true,
            onBeforeShow: function () {
                // 3/4/5th level menu  offscreen fix
                if (!$(this).parent().parent().hasClass('sf-menu')) {
                    var subMenuWidth = $(this).width();
                    var parentLi = $(this).parent();
                    var parentWidth = parentLi.width();
                    var subMenuRight = parentLi.offset().left + parentWidth + subMenuWidth;
                    if (subMenuRight > windowWidth) {
                        $(this).css('left', 'auto');
                        $(this).css('right', parentWidth + 'px');
                    }
                }
            }
        });
    }

    $(window).resize(function () {
        if (body.width() >= breakpoint && !sf.hasClass('sf-js-enabled')) {
            // you only want SuperFish to be re-enabled once (sf.hasClass)
            sf.superfish('init');
        } else if (body.width() < breakpoint) {
            // smaller screen, disable SuperFish
            sf.superfish('destroy');
        }
        windowWidth = $(window).width();
    });
});