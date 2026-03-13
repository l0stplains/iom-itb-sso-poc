<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username','password') displayInfo=realm.password && realm.registrationAllowed && !registrationDisabled??; section>
    
    <#if section = "header">
    <#elseif section = "form">
        <div class="custom-title">
            <h2>Selamat Datang ke Sistem<br/>IOM ITB!</h2>
        </div>
        
        <div id="kc-form">
          <div id="kc-form-wrapper">
            <form id="kc-form-login" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
                
                <div class="form-group">
                    <label for="username" class="control-label">Email</label>
                    <input tabindex="1" id="username" class="form-control" name="username" value="${(login.username!'')}" type="text" autofocus autocomplete="off" placeholder="Masukkan email anda ..." />
                </div>

                <div class="form-group">
                    <label for="password" class="control-label">Password</label>
                    <input tabindex="2" id="password" class="form-control" name="password" type="password" autocomplete="off" placeholder="Masukkan password anda ..." />

                    <#-- Logika pesan error (Login gagal atau Timeout) -->
                    <#if messagesPerField.existsError('username','password') || (message?? && (message.type = 'error' || message.type = 'warning'))>
                        <p class="error-text">
                            <#if messagesPerField.existsError('username','password')>
                                ${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}
                            <#else>
                                ${kcSanitize(message.summary)?no_esc}
                            </#if>
                        </p>
                    </#if>
                </div>

                <div class="form-group login-options">
                    <#if realm.resetPasswordAllowed>
                        <a tabindex="5" href="${url.loginResetCredentialsUrl}" class="forgot-password">Lupa sandi?</a>
                    </#if>
                </div>

                <div id="kc-form-buttons" class="form-group">
                    <input tabindex="4" class="btn btn-primary btn-block" name="login" id="kc-login" type="submit" value="Sign in"/>
                </div>
            </form>
          </div>
        </div>
    </#if>
</@layout.registrationLayout>