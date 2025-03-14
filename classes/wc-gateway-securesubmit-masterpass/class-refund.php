<?php

use Automattic\WooCommerce\Utilities\OrderUtil;

if (!defined('ABSPATH')) {
    exit();
}

class WC_Gateway_SecureSubmit_MasterPass_Refund
{
    protected $masterpass = null;

    public function __construct(&$masterpass = null)
    {
        $this->masterpass = $masterpass;
    }

    public function call($orderId, $amount = null, $reason = '')
    {
        $order = wc_get_order($orderId);

        try {
            if (!$order) {
                throw new Exception(__('Order cannot be found', 'wc_securesubmit'));
            }

            $orderId = WC_SecureSubmit_Util::getData($order, 'get_id', 'id');

            if (OrderUtil::custom_orders_table_usage_is_enabled()) {
                $masterpassOrderId = wc_get_order($orderId)->get_meta('_masterpass_order_id');
            } else {
                $masterpassOrderId = get_post_meta($orderId, '_masterpass_order_id', true);
            }

            if (!$masterpassOrderId) {
                throw new Exception(__('MasterPass order id cannot be found', 'wc_securesubmit'));
            }

            if (OrderUtil::custom_orders_table_usage_is_enabled()) {
                $masterpassPaymentStatus = wc_get_order($orderId)->get_meta('_masterpass_payment_status');
            } else {
                $masterpassPaymentStatus = get_post_meta($orderId, '_masterpass_payment_status', true);
            }

            if ($masterpassPaymentStatus === 'authorized') {
                throw new Exceptionsprintf(
                    esc_html__('Transaction has already been captured','wc_securesubmit' ));
            }
            if ($masterpassPaymentStatus !== 'captured') {
                throw new Exception(sprintf(
                    /* translators: %s: masterpassPaymentStatus */
                    esc_html__('Transaction has already been %s','wc_securesubmit' ),
                    $masterpassPaymentStatus)
                    );
            }

            $orderData = new HpsOrderData();
            $orderData->currencyCode = strtolower(get_woocommerce_currency());

            $service = $this->masterpass->getService();
            $response = $service->refund(
                $masterpassOrderId,
                $order->get_total() === $amount,
                $amount,
                $orderData
            );

            if (OrderUtil::custom_orders_table_usage_is_enabled()) {
                wc_get_order($orderId)->update_meta_data('_masterpass_payment_status', 'refunded');
            } else {
                update_post_meta($orderId, '_masterpass_payment_status', 'refunded', 'captured');
            }

            $order->add_order_note(__('MasterPass payment refunded', 'wc_securesubmit') . ' (Transaction ID: ' . $response->transactionId . ')');
            return true;
        } catch (Exception $e) {
            $error = __('Error:', 'wc_securesubmit') . ' "' . $e->getMessage() . '"';
            if (function_exists('wc_add_notice')) {
                wc_add_notice($error, 'error');
            } else if (method_exists(WC(), 'add_error')) {
                WC()->add_error($error);
            }
            return false;
        }
    }
}
