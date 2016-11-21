(function(window, document, Heartland, wc_securesubmit_params) {
    var addHandler = Heartland.Events.addHandler;

    function addClass(element, klass) {
      if (element.className.indexOf(klass) === -1) {
        element.className = element.className + ' ' + klass;
      }
    }

    function removeClass(element, klass) {
      if (element.className.indexOf(klass) === -1) return;
      element.className = element.className.replace(klass, '');
    }

    function toAll(elements, fun) {
        var i = 0;
        var length = elements.length;
        for (i; i < length; i++) {
            fun(elements[i]);
        }
    }

    function filter(elements, fun) {
        var i = 0;
        var length = elements.length;
        var result = [];
        for (i; i < length; i++) {
            if (fun(elements[i]) === true) {
                result.push(elements[i]);
            }
        }
        return result;
    }

    function clearFields() {
        toAll(document.querySelectorAll('.woocommerce_error, .woocommerce-error, .woocommerce-message, .woocommerce_message'), function(element) {
            element.remove();
        });
    }

    function cca() {
        if (document.getElementById('securesubmit_cca_data')) {
            return;
        }
        Cardinal.configure({logging:{level:'verbose'}});
        Cardinal.setup('init', {
            jwt: wc_securesubmit_params.cca.jwt
        });
        Cardinal.on('payments.validated', function (data, jwt) {
            console.log(data);
            var form = document.querySelector('form.checkout, form#order_review');
            var cca = document.createElement('input');
            data.jwt = jwt;
            cca.type = 'hidden';
            cca.id = 'securesubmit_cca_data';
            cca.name = 'securesubmit_cca_data';
            cca.value = JSON.stringify(data);
            form.appendChild(cca);
            jQuery(form).submit();
        });
        var token = document.getElementById('securesubmit_cardinal_token').value;
        Cardinal.start('cca', {
            OrderDetails: {
                OrderNumber: wc_securesubmit_params.cca.orderNumber + 'cca'
            },
            Token: {
                Token: token,
                ExpirationMonth: document.getElementById('exp_month').value,
                ExpirationYear: document.getElementById('exp_year').value
            }
        });
    }


    // Handles form submission when not using iframes
    function formHandler(e) {
        var securesubmitMethod = document.getElementById('payment_method_securesubmit');
        var storedCards = document.querySelectorAll('input[name=secure_submit_card]');
        var storedCardsChecked = filter(storedCards, function(el) {
            return el.checked;
        });
        var token = document.getElementById('securesubmit_token');
        var cardinalToken = document.getElementById('securesubmit_cardinal_token');
        var cardinalCcaData = document.getElementById('securesubmit_cca_data');

        var securesubmitEnabled = securesubmitMethod && securesubmitMethod.checked;
        var newCardUsed = storedCardsChecked.length === 0 || (storedCardsChecked[0] && storedCardsChecked[0].value === 'new');
        var ccaEnabled = !!wc_securesubmit_params.cca;
        var securesubmitTokenObtained = token.value !== '';
        var cardinalTokenObtained = cardinalToken && cardinalToken.value !== '';
        var cardinalCcaDataObtained = cardinalCcaData && cardinalCcaData.value !== '';

        if (!securesubmitEnabled) {
            return true;
        }

        if (newCardUsed && !securesubmitTokenObtained) {
            var card = document.getElementById('securesubmit_card_number');
            var cvv = document.getElementById('securesubmit_card_cvv');
            var expiration = document.getElementById('securesubmit_card_expiration');

            if (!expiration || expiration.value) {
                return false;
            }

            var split = expiration.value.split(' / ');
            var month = split[0].replace(/^\s+|\s+$/g, '');
            var year = split[1].replace(/^\s+|\s+$/g, '');

            var options = {
                publicKey: wc_securesubmit_params.key,
                cardNumber: card.value.replace(/\D/g, ''),
                cardCvv: cvv.value.replace(/\D/g, ''),
                cardExpMonth: month.replace(/\D/g, ''),
                cardExpYear: year.replace(/\D/g, ''),
                success: responseHandler,
                error: responseHandler
            };

            if (wc_securesubmit_params.cca) {
                options.cca = {
                    jwt: wc_securesubmit_params.cca.jwt,
                    orderNumber: wc_securesubmit_params.cca.orderNumber
                };
            }

            (new Heartland.HPS(options)).tokenize();

            return false;
        }

        console.log(ccaEnabled);
        console.log(cardinalTokenObtained);
        if (ccaEnabled && cardinalTokenObtained && !cardinalCcaDataObtained) {
            cca();
            return false;
        }

        console.log('form submit');
        return false;
    }

    // Handles form submission when using iframes
    function iframeFormHandler(e) {
        var securesubmitMethod = document.getElementById('payment_method_securesubmit');
        var storedCards = document.querySelectorAll('input[name=secure_submit_card]');
        var storedCardsChecked = filter(storedCards, function(el) {
            return el.checked;
        });
        var token = document.getElementById('securesubmit_token');
        var cardinalToken = document.getElementById('securesubmit_cardinal_token');
        var cardinalCcaData = document.getElementById('securesubmit_cca_data');

        var securesubmitEnabled = securesubmitMethod && securesubmitMethod.checked;
        var newCardUsed = storedCardsChecked.length === 0 || (storedCardsChecked[0] && storedCardsChecked[0].value === 'new');
        var ccaEnabled = !!wc_securesubmit_params.cca;
        var securesubmitTokenObtained = token.value !== '';
        var cardinalTokenObtained = cardinalToken && cardinalToken.value !== '';
        var cardinalCcaDataObtained = cardinalCcaData && cardinalCcaData.value !== '';

        if (!securesubmitEnabled) {
            return true;
        }

        if (newCardUsed && !securesubmitTokenObtained) {
            wc_securesubmit_params.hps.Messages.post({
                    accumulateData: true,
                    action: 'tokenize',
                    data: wc_securesubmit_params.hps.options
                },
                'cardNumber'
            );
            return false;
        }

        if (ccaEnabled && cardinalTokenObtained && !cardinalCcaDataObtained) {
            cca();
            return false;
        }

        return true;
    }

    // Handles tokenization response
    function responseHandler(response) {
        var form = document.querySelector('form.checkout, form#order_review');

        if (response.error || (response.heartland && response.heartland.error)) {
            var ul = document.createElement('ul');
            var li = document.createElement('li');
            clearFields();

            addClass(ul, 'woocommerce_error');
            addClass(ul, 'woocommerce-error');
            li.appendChild(document.createTextNode(response.error.message));
            ul.appendChild(li);

            document.querySelector('.securesubmit_new_card').insertBefore(
                ul,
                document.querySelector('.securesubmit_new_card_info')
            );
        } else {
            console.log(response);
            var heartland = response.heartland || response;
            var cardinal = response.cardinal;
            var token = document.getElementById('securesubmit_token');
            var last4 = document.createElement('input');
            var cType = document.createElement('input');
            var expMo = document.createElement('input');
            var expYr = document.createElement('input');

            token.value = heartland.token_value;

            last4.type = 'hidden';
            last4.id = 'last_four';
            last4.name = 'last_four';
            last4.value = heartland.last_four;

            cType.type = 'hidden';
            cType.id = 'card_type';
            cType.name = 'card_type';
            cType.value = heartland.card_type;

            expMo.type = 'hidden';
            expMo.id = 'exp_month';
            expMo.name = 'exp_month';
            expMo.value = heartland.exp_month;

            expYr.type = 'hidden';
            expYr.id = 'exp_year';
            expYr.name = 'exp_year';
            expYr.value = heartland.exp_year;

            form.appendChild(last4);
            form.appendChild(cType);
            form.appendChild(expMo);
            form.appendChild(expYr);

            if (cardinal) {
                var cardinalToken = document.createElement('input');
                cardinalToken.type = 'hidden';
                cardinalToken.id = 'securesubmit_cardinal_token';
                cardinalToken.name = 'securesubmit_cardinal_token';
                cardinalToken.value = cardinal.token_value;
                form.appendChild(cardinalToken);
                cca();
                return;
            }

            jQuery(form).submit();
        }

        setTimeout(function () {
            document.getElementById('securesubmit_token').value = '';
        }, 500);
    }

    // Load function to attach event handlers when WC refreshes payment fields
    window.securesubmitLoadEvents = function() {
        if (!Heartland) {
            return;
        }

        toAll(document.querySelectorAll('.card-number, .card-cvc, .expiry-date'), function(element) {
            addHandler(element, 'change', clearFields);
        });

        toAll(document.querySelectorAll('.saved-selector'), function(element) {
            addHandler(element, 'click', function(e) {
                var display = 'none';
                if (document.getElementById('secure_submit_card_new').checked) {
                    display = 'block';
                }
                toAll(document.querySelectorAll('.new-card-content'), function (el) {
                    el.style.display = display;
                });

                // Set active flag
                toAll(document.querySelectorAll('.saved-card'), function (el) {
                  removeClass(el, 'active');
                });
                addClass(element.parentNode.parentNode, 'active');
            });
        });

        if (document.querySelector('.securesubmit_new_card .card-number')) {
            Heartland.Card.attachNumberEvents('.securesubmit_new_card .card-number');
            Heartland.Card.attachExpirationEvents('.securesubmit_new_card .expiry-date');
            Heartland.Card.attachCvvEvents('.securesubmit_new_card .card-cvc');
        }
    };
    window.securesubmitLoadEvents();

    // Load function to build iframes when WC refreshes payment fields
    window.securesubmitLoadIframes = function() {
        if (!wc_securesubmit_params.use_iframes) {
            return;
        }
        var options = {
            publicKey: wc_securesubmit_params.key,
            type: 'iframe',
            fields: {
                cardNumber: {
                    target: 'securesubmit_card_number',
                    placeholder: '•••• •••• •••• ••••'
                },
                cardExpiration: {
                    target: 'securesubmit_card_expiration',
                    placeholder: 'MM / YYYY'
                },
                cardCvv: {
                    target: 'securesubmit_card_cvv',
                    placeholder: 'CVV'
                }
            },
            style: {
                'input': {
                    'background': '#fff',
                    'border': '1px solid #666',
                    'border-color': '#bbb3b9 #c7c1c6 #c7c1c6',
                    'box-sizing': 'border-box',
                    'font-family': 'Arial, Helvetica Neue, Helvetica, sans-serif',
                    'font-size': '18px !important',
                    'line-height': '18px !important',
                    'margin': '0 .5em 0 0',
                    'max-width': '100%',
                    'outline': '0',
                    'padding': '15px 13px 13px 13px',
                    'vertical-align': 'middle',
                    'width': '100%'
                },
                '#heartland-field-body': {
                    'width': '100%'
                },
                '#heartland-field-wrapper': {
                    'position': 'relative'
                },
                // Card Number
                '#heartland-field[name="cardNumber"] + .extra-div-1': {
                    'display': 'block',
                    'width': '56px',
                    'height': '44px',
                    'position': 'absolute',
                    'top': '4px',
                    'right': '10px',
                    'background-position': 'bottom',
                    'background-repeat': 'no-repeat',
                    'background-size': '56px auto'
                },
                '#heartland-field[name="cardNumber"].valid + .extra-div-1': {
                    'background-position': 'top'
                },
                '#heartland-field.card-type-visa + .extra-div-1': {
                    'background-image': 'url("' + wc_securesubmit_params.images_dir + '/ss-inputcard-visa@2x.png")'
                },
                '#heartland-field.card-type-jcb + .extra-div-1': {
                    'background-image': 'url("' + wc_securesubmit_params.images_dir + '/ss-inputcard-jcb@2x.png")'
                },
                '#heartland-field.card-type-discover + .extra-div-1': {
                    'background-image': 'url("' + wc_securesubmit_params.images_dir + '/ss-inputcard-discover@2x.png")'
                },
                '#heartland-field.card-type-amex + .extra-div-1': {
                    'background-image': 'url("' + wc_securesubmit_params.images_dir + '/ss-inputcard-amex@2x.png")'
                },
                '#heartland-field.card-type-mastercard + .extra-div-1': {
                    'background-image': 'url("' + wc_securesubmit_params.images_dir + '/ss-inputcard-mastercard@2x.png")'
                },
                '@media only screen and (max-width : 290px)': {
                    '#heartland-field[name="cardNumber"] + .extra-div-1': {
                        'display': 'none'
                    }
                },
                // Card CVV
                '#heartland-field[name="cardCvv"] + .extra-div-1': {
                    'display': 'block',
                    'width': '59px',
                    'height': '39px',
                    'background-image': 'url("' + wc_securesubmit_params.images_dir + '/ss-cvv@2x.png")',
                    'background-size': '59px auto',
                    'background-position': 'top',
                    'position': 'absolute',
                    'top': '6px',
                    'right': '7px'
                }
            },
            onTokenSuccess: responseHandler,
            onTokenError: responseHandler
        };

        if (wc_securesubmit_params.cca) {
            options.cca = {
                jwt: wc_securesubmit_params.cca.jwt,
                orderNumber: wc_securesubmit_params.cca.orderNumber
            };
        }

        wc_securesubmit_params.hps = new Heartland.HPS(options);
        if (!wc_securesubmit_params.hpsReadyHandler) {
            wc_securesubmit_params.hpsReadyHandler = function () {
                setTimeout(function () {
                    document.getElementById('heartland-frame-cardNumber').style.height = '52px';
                    document.getElementById('heartland-frame-cardExpiration').style.height = '52px';
                    document.getElementById('heartland-frame-cardCvv').style.height = '52px';
                }, 500);
            };
        }
        Heartland.Events.removeHandler(document, 'securesubmitIframeReady', wc_securesubmit_params.hpsReadyHandler);
        Heartland.Events.addHandler(document, 'securesubmitIframeReady', wc_securesubmit_params.hpsReadyHandler);
    };
    window.securesubmitLoadIframes();

    addHandler(document, 'DOMContentLoaded', function() {
        if (!wc_securesubmit_params.handler) {
            var handler = formHandler;
            if (wc_securesubmit_params.use_iframes) {
                handler = iframeFormHandler;
            }
            wc_securesubmit_params.handler = handler;
        }

        jQuery('form#order_review')
            .off('submit', wc_securesubmit_params.handler)
            .on('submit', wc_securesubmit_params.handler);
        jQuery('form.checkout')
            .off('checkout_place_order_securesubmit', wc_securesubmit_params.handler)
            .on('checkout_place_order_securesubmit', wc_securesubmit_params.handler);
    });

    function processGiftCardResponse(msg) {
        var giftCardResponse = JSON.parse(msg);

        if (giftCardResponse.error === 1) {
            jQuery('#gift-card-error').text(giftCardResponse.message).show('fast');
        } else if (giftCardResponse.error === 0) {
            jQuery('#gift-card-success').text("Your gift card was applied to the order.").show('fast');
            jQuery('body').trigger('update_checkout');
        }
    }

    window.removeGiftCards = function (clickedElement) {
        var removedCardID = jQuery(clickedElement).attr('id');

        jQuery.ajax({
            url: ajaxurl,
            type: "POST",
            data: {
                action: 'remove_gift_card',
                securesubmit_card_id: removedCardID
            }
        }).done(function () {
            jQuery('body').trigger('update_checkout');
        });
    };

    window.applyGiftCard = function () {
        jQuery.ajax({
            url: ajaxurl,
            type: "POST",
            data: {
                action: 'use_gift_card',
                gift_card_number: jQuery('#gift-card-number').val(),
                gift_card_pin: jQuery('#gift-card-pin').val()
            }
        }).success(processGiftCardResponse);
    };
}(window, document, window.Heartland, window.wc_securesubmit_params));
